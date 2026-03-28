import { EventEmitter } from "events";
import type { LiveServerToolCall } from "@google/genai";
import type {
  MeetingSession,
  MeetingBotStatus,
  TranscriptEntry,
  MeetingAudioSessionState,
  RecallRealtimeEvent,
} from "./types.js";
import { MeetingContextManager } from "./contextManager.js";
import { GeminiLiveSession } from "../gemini/liveClient.js";
import * as recallClient from "./recallClient.js";
import { onStatusChange } from "./webhooks.js";
import { emitServerEvent } from "../events.js";
import { executeToolCalls } from "../tools/executor.js";
import {
  checkCalendarAvailability,
  createCalendarEvent,
  searchBusiness,
} from "../tools/schema.js";
import { MEETING_ASSISTANT_PROMPT } from "../gemini/prompts.js";
import { config } from "../config.js";

const DEFAULT_COOLDOWN_MS = 15_000;
const WAKE_WINDOW_MS = 20_000;
const LOG_PREVIEW_MAX_CHARS = 120;
const BOT_AUDIO_SAMPLE_RATE = 24_000;
const GENERATION_SUPPRESSION_MS = 15_000;
const WAKE_PREFIXES = ["", "hey", "hi", "okay", "ok", "yo"] as const;
const WAKE_ALIASES = [
  "yapper",
  "yaper",
  "yapr",
  "yappa",
  "assistant",
] as const;

function meetingPrompt(): string {
  return [
    MEETING_ASSISTANT_PROMPT,
    "You are listening to live meeting audio.",
    "Only respond when directly addressed with the wake name family 'Yapper', including close variants like 'Hey Yapper', 'Hi Yapper', 'Okay Yapper', and phonetic spellings such as 'Yaper', 'Yapr', or 'Yappa'. Also respond to the fallback wake phrase 'Hey Assistant' or 'Assistant'.",
    "If nobody addresses you directly, stay silent and do not use any tools.",
    "Keep spoken responses concise and useful.",
  ].join(" ");
}

interface WakeMatch {
  normalizedText: string;
  matchedAlias: string | null;
  matchedPattern: string | null;
}

interface WakeAliasVariant {
  alias: string;
  compact: string;
}

function normalizeWakeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[-,]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactWakeText(text: string): string {
  return text.replace(/\s+/g, "");
}

function buildWakeAliasVariants(): WakeAliasVariant[] {
  return WAKE_ALIASES.map((alias) => ({
    alias,
    compact: compactWakeText(alias),
  }));
}

const WAKE_ALIAS_VARIANTS = buildWakeAliasVariants();

function findCompactWakeTokenMatch(
  normalizedText: string,
): Pick<WakeMatch, "matchedAlias" | "matchedPattern"> {
  const tokens = normalizedText.split(" ").filter(Boolean);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const previousToken = index > 0 ? tokens[index - 1] : "";

    for (const variant of WAKE_ALIAS_VARIANTS) {
      const exactCompactMatch = token === variant.compact;
      const relaxedCompactMatch =
        token.startsWith(variant.compact) &&
        token.length <= variant.compact.length + 2;

      if (!exactCompactMatch && !relaxedCompactMatch) {
        continue;
      }

      if (
        previousToken &&
        WAKE_PREFIXES.some((prefix) => prefix && prefix === previousToken)
      ) {
        return {
          matchedAlias: variant.alias,
          matchedPattern: `${previousToken} ${variant.alias} (compact)`,
        };
      }

      if (!previousToken || index === 0) {
        return {
          matchedAlias: variant.alias,
          matchedPattern: `${variant.alias} (compact)`,
        };
      }
    }
  }

  return {
    matchedAlias: null,
    matchedPattern: null,
  };
}

function findWakeMatch(text: string): WakeMatch {
  const normalizedText = normalizeWakeText(text);

  for (const alias of WAKE_ALIASES) {
    const aliasPattern = escapeRegex(alias);
    for (const prefix of WAKE_PREFIXES) {
      const pattern = prefix
        ? `\\b${escapeRegex(prefix)}\\s+${aliasPattern}\\b`
        : `\\b${aliasPattern}\\b`;

      if (new RegExp(pattern, "u").test(normalizedText)) {
        return {
          normalizedText,
          matchedAlias: alias,
          matchedPattern: prefix ? `${prefix} ${alias}` : alias,
        };
      }
    }
  }

  const compactMatch = findCompactWakeTokenMatch(normalizedText);
  if (compactMatch.matchedAlias) {
    return {
      normalizedText,
      matchedAlias: compactMatch.matchedAlias,
      matchedPattern: compactMatch.matchedPattern,
    };
  }

  return {
    normalizedText,
    matchedAlias: null,
    matchedPattern: null,
  };
}

function preview(text: string): string {
  return text.length <= LOG_PREVIEW_MAX_CHARS
    ? text
    : `${text.slice(0, LOG_PREVIEW_MAX_CHARS)}...`;
}

function now(): number {
  return Date.now();
}

function resetTurnState(state: MeetingAudioSessionState): void {
  state.currentTurnActive = false;
  state.currentTurnAccepted = false;
  state.currentTurnHadWakeWord = false;
  state.currentTurnInputTexts = [];
  state.currentTurnOutputTexts = [];
  state.currentTurnOutputAudio = [];
}

export interface MeetingOrchestratorEvents {
  statusChange: (session: MeetingSession) => void;
  response: (botId: string, question: string, answer: string) => void;
  ended: (session: MeetingSession) => void;
  error: (botId: string, error: Error) => void;
}

export interface MeetingOrchestratorOptions {
  cooldownMs?: number;
}

export class MeetingOrchestrator extends EventEmitter {
  private sessions: Map<string, MeetingSession> = new Map();
  private contextManagers: Map<string, MeetingContextManager> = new Map();
  private audioSessions: Map<string, MeetingAudioSessionState> = new Map();
  private cooldownMs: number;
  private lastResponseTime: Map<string, number> = new Map();

  constructor(options: MeetingOrchestratorOptions = {}) {
    super();
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    onStatusChange((botId, status) => this.handleStatusChange(botId, status));
  }

  async joinMeeting(
    meetingUrl: string,
    botName?: string,
  ): Promise<MeetingSession> {
    const botResponse = await recallClient.createBot(meetingUrl, botName);

    const session: MeetingSession = {
      botId: botResponse.id,
      meetingUrl,
      status: "creating",
      participants: [],
      startedAt: new Date(),
      contextWindow: [],
    };

    this.sessions.set(botResponse.id, session);
    this.contextManagers.set(botResponse.id, new MeetingContextManager());
    this.createAudioSession(botResponse.id);

    console.log(
      `[MeetingOrchestrator] Bot ${botResponse.id} created for meeting: ${meetingUrl}`,
    );

    emitServerEvent("meeting_joined", {
      botId: botResponse.id,
      meetingUrl,
      status: session.status,
    });

    return { ...session };
  }

  async leaveMeeting(botId: string): Promise<void> {
    const session = this.sessions.get(botId);
    if (!session) {
      throw new Error(`No session found for bot ${botId}`);
    }

    try {
      await recallClient.removeBot(botId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MeetingOrchestrator] Error removing bot ${botId}: ${msg}`);
    }

    this.updateSessionStatus(botId, "done");
    this.cleanupSession(botId);
  }

  getSession(botId: string): MeetingSession | undefined {
    const session = this.sessions.get(botId);
    return session ? { ...session } : undefined;
  }

  getAllSessions(): MeetingSession[] {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }

  getTranscript(botId: string): TranscriptEntry[] {
    const cm = this.contextManagers.get(botId);
    return cm ? cm.getTranscript() : [];
  }

  getSummary(botId: string): string {
    const cm = this.contextManagers.get(botId);
    return cm ? cm.getSummary() : "No session found.";
  }

  handleRealtimeEvent(event: RecallRealtimeEvent): void {
    const botId = event.data.bot.id;
    const state = this.audioSessions.get(botId);
    if (!state) {
      return;
    }

    switch (event.event) {
      case "audio_mixed_raw.data": {
        state.recallAudioConnected = true;
        if (now() < state.suppressIncomingAudioUntil) {
          return;
        }
        if (!event.data.data.buffer) {
          return;
        }
        const audio = Buffer.from(event.data.data.buffer, "base64");
        state.currentTurnActive = true;
        state.geminiSession.sendAudio(audio);
        break;
      }

      case "participant_events.speech_on":
      case "participant_events.speech_off": {
        const participantName = event.data.participant?.name;
        if (!participantName) {
          return;
        }
        const cm = this.contextManagers.get(botId);
        const session = this.sessions.get(botId);
        if (!cm || !session) {
          return;
        }
        const participants = cm.getParticipants();
        if (!participants.some((p) => p.name === participantName)) {
          cm.addTranscriptEntry({
            speaker: participantName,
            text:
              event.event === "participant_events.speech_on"
                ? "[speaking]"
                : "[stopped speaking]",
            timestamp: new Date(),
          });
          session.participants = cm.getParticipants();
          session.contextWindow = cm.getTranscript();
        }
        break;
      }
    }
  }

  private createAudioSession(botId: string): void {
    const geminiSession = new GeminiLiveSession({
      model: config.gemini.liveModel,
      systemInstruction: meetingPrompt(),
      tools: [checkCalendarAvailability, createCalendarEvent, searchBusiness],
      responseModalities: ["AUDIO"],
      inputAudioTranscription: true,
      outputAudioTranscription: true,
    });

    const state: MeetingAudioSessionState = {
      botId,
      geminiSession,
      recallAudioConnected: false,
      geminiConnected: false,
      wakeActiveUntil: 0,
      suppressIncomingAudioUntil: 0,
      currentTurnActive: false,
      currentTurnAccepted: false,
      currentTurnHadWakeWord: false,
      currentTurnInputTexts: [],
      currentTurnOutputTexts: [],
      currentTurnOutputAudio: [],
      speaking: false,
    };

    this.audioSessions.set(botId, state);
    this.wireGeminiSession(botId, state);
    geminiSession.connect().catch((err) => {
      this.emit(
        "error",
        botId,
        err instanceof Error ? err : new Error(String(err)),
      );
    });
  }

  private wireGeminiSession(
    botId: string,
    state: MeetingAudioSessionState,
  ): void {
    state.geminiSession.on("connected", () => {
      state.geminiConnected = true;
      console.log(
        `[MeetingOrchestrator] Gemini Live connected for bot ${botId}`,
      );
    });

    state.geminiSession.on("disconnected", () => {
      state.geminiConnected = false;
      console.log(
        `[MeetingOrchestrator] Gemini Live disconnected for bot ${botId}`,
      );
    });

    state.geminiSession.on("inputTranscription", (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || now() < state.suppressIncomingAudioUntil) {
        return;
      }

      state.currentTurnActive = true;
      state.currentTurnInputTexts.push(trimmed);

      const wakeMatch = findWakeMatch(trimmed);
      const explicitWake = wakeMatch.matchedAlias !== null;
      const withinWakeWindow = now() < state.wakeActiveUntil;
      const cooldownActive =
        !explicitWake &&
        !withinWakeWindow &&
        now() - (this.lastResponseTime.get(botId) ?? 0) < this.cooldownMs;

      console.log(
        `[MeetingOrchestrator] Input transcription for bot ${botId}: raw="${preview(trimmed)}" normalized="${preview(wakeMatch.normalizedText)}"`,
      );

      if (explicitWake) {
        state.currentTurnHadWakeWord = true;
        state.currentTurnAccepted = true;
        state.wakeActiveUntil = now() + WAKE_WINDOW_MS;
        console.log(
          `[MeetingOrchestrator] Wake word detected for bot ${botId}: alias="${wakeMatch.matchedAlias}" pattern="${wakeMatch.matchedPattern}" raw="${preview(trimmed)}"`,
        );
      } else if (withinWakeWindow && !cooldownActive) {
        state.currentTurnAccepted = true;
        console.log(
          `[MeetingOrchestrator] Accepted follow-up turn for bot ${botId}: wakeWindowActive=true cooldownActive=${cooldownActive}`,
        );
      } else {
        console.log(
          `[MeetingOrchestrator] No wake match for bot ${botId}: wakeWindowActive=${withinWakeWindow} cooldownActive=${cooldownActive}`,
        );
      }
    });

    state.geminiSession.on("outputTranscription", (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      if (state.currentTurnAccepted) {
        state.speaking = true;
        state.suppressIncomingAudioUntil = Math.max(
          state.suppressIncomingAudioUntil,
          now() + GENERATION_SUPPRESSION_MS,
        );
        state.currentTurnOutputTexts.push(trimmed);
        console.log(
          `[MeetingOrchestrator] Gemini output transcription for bot ${botId}: "${trimmed}"`,
        );
      } else {
        console.log(
          `[MeetingOrchestrator] Dropping Gemini output transcription before wake for bot ${botId}: "${preview(trimmed)}"`,
        );
      }
    });

    state.geminiSession.onAudio((audio: Buffer) => {
      if (state.currentTurnAccepted) {
        state.speaking = true;
        state.suppressIncomingAudioUntil = Math.max(
          state.suppressIncomingAudioUntil,
          now() + GENERATION_SUPPRESSION_MS,
        );
        state.currentTurnOutputAudio.push(audio);
        console.log(
          `[MeetingOrchestrator] Buffered Gemini audio for bot ${botId}: ${audio.length} bytes`,
        );
      } else {
        console.log(
          `[MeetingOrchestrator] Dropping Gemini audio before wake for bot ${botId}: ${audio.length} bytes`,
        );
      }
    });

    state.geminiSession.on("toolCall", (toolCall: LiveServerToolCall) => {
      this.handleToolCall(botId, toolCall).catch((err) => {
        this.emit(
          "error",
          botId,
          err instanceof Error ? err : new Error(String(err)),
        );
      });
    });

    state.geminiSession.on("turnComplete", () => {
      this.finishTurn(botId).catch((err) => {
        this.emit(
          "error",
          botId,
          err instanceof Error ? err : new Error(String(err)),
        );
      });
    });

    state.geminiSession.on("error", (err: Error) => {
      console.error(
        `[MeetingOrchestrator] Gemini error for ${botId}: ${err.message}`,
      );
      this.emit("error", botId, err);
    });
  }

  private async handleToolCall(
    botId: string,
    toolCall: LiveServerToolCall,
  ): Promise<void> {
    const state = this.audioSessions.get(botId);
    if (!state) {
      return;
    }

    const calls = toolCall.functionCalls ?? [];
    if (calls.length === 0) {
      return;
    }

    const allowed = state.currentTurnAccepted || now() < state.wakeActiveUntil;

    if (!allowed) {
      state.geminiSession.sendToolResponse(
        calls.map((fc) => ({
          name: fc.name ?? "unknown",
          response: { ignored: true, reason: "Wake word not detected" },
        })),
      );
      return;
    }

    const responses = await executeToolCalls(
      calls.map((fc) => ({
        name: fc.name ?? "unknown",
        args: (fc.args as Record<string, unknown>) ?? {},
      })),
    );
    state.geminiSession.sendToolResponse(responses);
  }

  private async finishTurn(botId: string): Promise<void> {
    const state = this.audioSessions.get(botId);
    const cm = this.contextManagers.get(botId);
    const session = this.sessions.get(botId);
    if (!state || !cm || !session) {
      return;
    }

    const question = state.currentTurnInputTexts.join(" ").trim();
    const answer = state.currentTurnOutputTexts.join(" ").trim();

    if (question) {
      cm.addTranscriptEntry({
        speaker: "Meeting",
        text: question,
        timestamp: new Date(),
      });
    }

    if (state.currentTurnAccepted && answer) {
      cm.addTranscriptEntry({
        speaker: "Voisli",
        text: answer,
        timestamp: new Date(),
      });
    }

    session.participants = cm.getParticipants();
    session.contextWindow = cm.getTranscript();

    if (state.currentTurnAccepted && state.currentTurnOutputAudio.length > 0) {
      const pcm = Buffer.concat(state.currentTurnOutputAudio);
      const durationMs = Math.ceil(
        (pcm.length / 2 / BOT_AUDIO_SAMPLE_RATE) * 1000,
      );
      console.log(
        `[MeetingOrchestrator] Sending response audio to Recall for bot ${botId}: ${pcm.length} bytes durationMs=${durationMs}`,
      );
      await recallClient.sendAudioToMeeting(botId, pcm, BOT_AUDIO_SAMPLE_RATE);
      state.speaking = true;
      state.suppressIncomingAudioUntil = now() + durationMs + 750;
      this.lastResponseTime.set(botId, now());
      this.emit("response", botId, question, answer);
      emitServerEvent("bot_spoke", { botId, question, answer });
    } else if (state.currentTurnAccepted) {
      console.log(
        `[MeetingOrchestrator] Accepted turn produced no output audio for bot ${botId}: answerChars=${answer.length}`,
      );
    }

    state.speaking = false;
    resetTurnState(state);
  }

  private handleStatusChange(botId: string, status: MeetingBotStatus): void {
    const session = this.sessions.get(botId);
    if (!session) return;

    this.updateSessionStatus(botId, status);

    if (status === "done" || status === "error") {
      this.cleanupSession(botId);
    }
  }

  private updateSessionStatus(botId: string, status: MeetingBotStatus): void {
    const session = this.sessions.get(botId);
    if (!session) return;

    session.status = status;
    if (status === "done" || status === "error") {
      session.endedAt = new Date();
    }

    this.emit("statusChange", { ...session });
  }

  private cleanupSession(botId: string): void {
    const state = this.audioSessions.get(botId);
    if (state) {
      state.geminiSession.close();
      this.audioSessions.delete(botId);
    }

    const session = this.sessions.get(botId);
    if (session) {
      this.emit("ended", { ...session });
    }

    console.log(`[MeetingOrchestrator] Session ${botId} cleaned up`);
  }
}

export const meetingOrchestrator = new MeetingOrchestrator();
export { findWakeMatch, normalizeWakeText };

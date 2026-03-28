import { geminiToTwilio, twilioToGemini } from "../audio/converter.js";
import { emitServerEvent } from "../events.js";
import * as recallClient from "../meeting/recallClient.js";
import { createBot, removeBot } from "../meeting/recallClient.js";
import type { TwilioMediaStream } from "../twilio/mediaStream.js";
import { GeminiLiveTranscriber, type SpeechTranscriber } from "./geminiTranscriber.js";
import {
  GeminiSpeechSynthesizer,
  type SpeechSynthesizer,
} from "./geminiSpeech.js";
import { mainAgentClient } from "./mainAgentClient.js";
import { VoiceSessionStore } from "./sessionStore.js";
import type {
  AssistRequestPayload,
  RecallLifecycle,
  SessionEndPayload,
  TtsItem,
  VoiceSessionArchive,
  VoiceSessionBuffer,
  VoiceTranscriptTurn,
} from "./types.js";

const MAX_ASSIST_TURNS = 8;
const MIN_TWILIO_AUDIO_CHUNK_BYTES = 4_000;
const TWILIO_FILLER_PHRASE = "One moment.";
const FALLBACK_REPLY = "Sorry, I had trouble with that. Please try again.";
const MEETING_BOT_NAME = "Voicely";
const SESSION_END_RETRY_BASE_MS = 1_000;
const SESSION_END_RETRY_MAX_MS = 30_000;

function isNaturalGap(text: string): boolean {
  return /[.?!]["'”)]?$/.test(text.trim());
}

function shouldAskMeetingAssistant(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes("voicely") || normalized.includes("assistant") || text.includes("?");
}

function getTurnSequence(turnId: string | undefined): number {
  if (!turnId) {
    return 0;
  }

  const suffix = turnId.split(":").at(-1) ?? "0";
  const sequence = Number.parseInt(suffix, 10);
  return Number.isFinite(sequence) ? sequence : 0;
}

function nextRetryDelay(retryCount: number): number {
  return Math.min(SESSION_END_RETRY_BASE_MS * 2 ** retryCount, SESSION_END_RETRY_MAX_MS);
}

interface VoiceCoordinatorDependencies {
  agentClient: {
    requestAssist: (
      payload: AssistRequestPayload,
      signal?: AbortSignal
    ) => Promise<{
      turn_id: string;
      say: string;
      should_end_session: boolean;
      metadata?: Record<string, unknown>;
    }>;
    sendSessionEnd: (payload: SessionEndPayload) => Promise<boolean>;
  };
  speechSynthesizer: SpeechSynthesizer;
  store: VoiceSessionStore;
  createMeetingBot: typeof createBot;
  leaveMeetingBot: typeof removeBot;
  sendMeetingAudio: typeof recallClient.sendAudioToMeeting;
  createSpeechTranscriber: () => SpeechTranscriber;
}

export class VoiceCoordinator {
  constructor(private readonly deps: VoiceCoordinatorDependencies) {}

  createPhoneSession(
    sessionId: string,
    phoneNumber: string,
    metadata?: Record<string, unknown>
  ): VoiceSessionBuffer {
    const existing = this.deps.store.getSession(sessionId);
    if (existing) {
      return existing;
    }

    const session = this.deps.store.createPhoneSession({
      sessionId,
      phoneNumber,
      metadata,
    });

    emitServerEvent("call_started", {
      callId: sessionId,
      sessionId,
      direction: "outbound",
      purpose: typeof session.metadata.purpose === "string" ? session.metadata.purpose : undefined,
      status: "connecting",
    });

    return session;
  }

  async createMeetingSession(
    sessionId: string,
    meetingUrl: string,
    botName?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ session: VoiceSessionBuffer; botId: string }> {
    const existing = this.deps.store.getSession(sessionId);
    if (existing?.provider.recall?.botId) {
      return { session: existing, botId: existing.provider.recall.botId };
    }

    const session = this.deps.store.createMeetingSession({
      sessionId,
      meetingUrl,
      botName,
      metadata,
    });

    const bot = await this.deps.createMeetingBot(meetingUrl, botName ?? MEETING_BOT_NAME);
    const linkedSession = this.deps.store.linkBot(sessionId, bot.id);

    emitServerEvent("meeting_joined", {
      sessionId,
      botId: bot.id,
      meetingUrl,
      status: "joining",
    });

    return { session: linkedSession, botId: bot.id };
  }

  getSession(sessionId: string): VoiceSessionBuffer | undefined {
    return this.deps.store.getSession(sessionId);
  }

  getSessionSnapshot(sessionId: string): VoiceSessionBuffer | VoiceSessionArchive | undefined {
    return this.deps.store.getSessionSnapshot(sessionId);
  }

  getAllSessions(): VoiceSessionBuffer[] {
    return this.deps.store.getAllSessions();
  }

  getAllArchivedSessions(): VoiceSessionArchive[] {
    return this.deps.store.getArchivedSessions();
  }

  getAllSessionSnapshots(): Array<VoiceSessionBuffer | VoiceSessionArchive> {
    return [...this.getAllSessions(), ...this.getAllArchivedSessions()];
  }

  getSessionByBotId(botId: string): VoiceSessionBuffer | undefined {
    return this.deps.store.getSessionByBotId(botId);
  }

  getSessionSnapshotByBotId(botId: string): VoiceSessionBuffer | VoiceSessionArchive | undefined {
    return this.deps.store.getSessionByBotId(botId) ?? this.deps.store.getArchivedSessionByBotId(botId);
  }

  getSessionIdByBotId(botId: string): string | undefined {
    return this.deps.store.getSessionIdByBotId(botId);
  }

  attachTwilioTransport(sessionId: string, transport: TwilioMediaStream): void {
    const session = this.deps.store.requireSession(sessionId);
    if (!session.provider.twilio) {
      throw new Error(`Session ${sessionId} is not a phone session`);
    }

    session.provider.twilio.mediaStream = transport;
    session.provider.twilio.pendingAudio = Buffer.alloc(0);
    session.provider.twilio.sttSession?.close();

    const transcriber = this.deps.createSpeechTranscriber();
    session.provider.twilio.sttSession = transcriber;

    transcriber.onFinalTranscript((text) => {
      void this.handleHumanTurn(sessionId, "caller", text);
    });

    transcriber.onError((error) => {
      console.error(`[VoiceCoordinator] Twilio STT error for ${sessionId}: ${error.message}`);
    });

    void transcriber.connect().catch((error) => {
      console.error(`[VoiceCoordinator] Failed to connect Twilio STT for ${sessionId}: ${error.message}`);
    });

    transport.on("start", ({ callSid, streamSid }) => {
      const current = this.deps.store.getSession(sessionId);
      if (!current?.provider.twilio) {
        return;
      }

      current.provider.twilio.callSid = callSid;
      current.provider.twilio.streamSid = streamSid;
    });

    transport.on("audio", (base64MulawAudio: string) => {
      const current = this.deps.store.getSession(sessionId);
      if (!current || current.status !== "active" || !current.provider.twilio?.sttSession) {
        return;
      }

      const pcm16Audio = twilioToGemini(base64MulawAudio);
      current.provider.twilio.pendingAudio = Buffer.concat([
        current.provider.twilio.pendingAudio ?? Buffer.alloc(0),
        pcm16Audio,
      ]);

      if (current.provider.twilio.pendingAudio.length >= MIN_TWILIO_AUDIO_CHUNK_BYTES) {
        current.provider.twilio.sttSession.sendAudio(current.provider.twilio.pendingAudio);
        current.provider.twilio.pendingAudio = Buffer.alloc(0);
      }
    });

    transport.on("stop", () => {
      void this.handleTwilioTerminalEvent(sessionId, "twilio_stream_closed");
    });

    transport.on("error", (error) => {
      console.error(`[VoiceCoordinator] Twilio media stream error for ${sessionId}: ${error.message}`);
    });
  }

  updateTwilioCallReference(sessionId: string, callSid: string): void {
    const session = this.deps.store.getSession(sessionId);
    if (session?.provider.twilio) {
      session.provider.twilio.callSid = callSid;
    }
  }

  async handleHumanTurn(sessionId: string, speaker: string, text: string): Promise<void> {
    const session = this.deps.store.getSession(sessionId);
    if (!session || session.status !== "active") {
      return;
    }

    const turn = this.appendTurn(session, "user", speaker, text);

    if (session.channel === "meeting" && session.provider.recall && isNaturalGap(text)) {
      session.provider.recall.latestGapTurnId = turn.turn_id;
    }

    if (session.channel === "meeting" && !shouldAskMeetingAssistant(text)) {
      await this.maybeSpeakMeetingOutput(sessionId);
      return;
    }

    session.assist.queuedTurnId = turn.turn_id;
    if (!session.assist.inFlight) {
      await this.processNextAssistTurn(sessionId);
    }
  }

  async handleMeetingTranscript(botId: string, speaker: string, text: string): Promise<void> {
    const sessionId = this.deps.store.getSessionIdByBotId(botId);
    if (!sessionId) {
      return;
    }

    await this.handleHumanTurn(sessionId, speaker, text);
  }

  async handleMeetingLifecycle(botId: string, status: RecallLifecycle): Promise<void> {
    const session = this.deps.store.getSessionByBotId(botId);
    if (!session?.provider.recall) {
      return;
    }

    session.provider.recall.lifecycle = status;

    if (status === "done" || status === "error") {
      await this.transitionToEnding(
        session.sessionId,
        status === "done" ? "meeting_completed" : "meeting_error"
      );
    }
  }

  async leaveMeeting(sessionId: string): Promise<void> {
    const session = this.deps.store.getSession(sessionId);
    if (!session?.provider.recall) {
      throw new Error(`Session ${sessionId} is not a live meeting session`);
    }

    if (session.provider.recall.botId) {
      await this.deps.leaveMeetingBot(session.provider.recall.botId).catch(() => undefined);
    }

    await this.transitionToEnding(sessionId, "meeting_left");
  }

  async handleTwilioTerminalEvent(sessionId: string, reason: string): Promise<void> {
    await this.transitionToEnding(sessionId, reason);
  }

  private nextTurnId(session: VoiceSessionBuffer): string {
    session.turnCounter += 1;
    return `${session.sessionId}:${session.turnCounter}`;
  }

  private appendTurn(
    session: VoiceSessionBuffer,
    role: VoiceTranscriptTurn["role"],
    speaker: string,
    text: string
  ): VoiceTranscriptTurn {
    const turn: VoiceTranscriptTurn = {
      turn_id: this.nextTurnId(session),
      role,
      speaker,
      text,
      timestamp: new Date().toISOString(),
    };

    session.transcript.push(turn);
    emitServerEvent("transcript_update", {
      sessionId: session.sessionId,
      botId: session.provider.recall?.botId,
      channel: session.channel,
      role,
      speaker,
      text,
      timestamp: turn.timestamp,
    });

    return turn;
  }

  private buildSessionMetadata(session: VoiceSessionBuffer): Record<string, unknown> {
    return {
      ...session.metadata,
      twilio_call_sid: session.provider.twilio?.callSid,
      bot_id: session.provider.recall?.botId,
      meeting_url: session.provider.recall?.meetingUrl,
      phone_number: session.provider.twilio?.phoneNumber,
    };
  }

  private buildAssistPayload(session: VoiceSessionBuffer, turnId: string): AssistRequestPayload {
    return {
      session_id: session.sessionId,
      turn_id: turnId,
      channel: session.channel,
      recent_turns: session.transcript.slice(-MAX_ASSIST_TURNS).map((turn) => ({ ...turn })),
      metadata: this.buildSessionMetadata(session),
    };
  }

  private enqueueOutput(session: VoiceSessionBuffer, text: string, kind: TtsItem["kind"], turnId?: string): void {
    session.output.queuedTts.push({
      id: `${session.sessionId}:tts:${session.output.queuedTts.length + 1}:${Date.now()}`,
      text,
      kind,
      queuedAt: new Date().toISOString(),
      turnId,
    });
  }

  private async processNextAssistTurn(sessionId: string): Promise<void> {
    const session = this.deps.store.getSession(sessionId);
    const queuedTurnId = session?.assist.queuedTurnId;

    if (!session || session.status !== "active" || !queuedTurnId) {
      return;
    }

    session.assist.inFlight = true;
    session.assist.activeTurnId = queuedTurnId;
    session.assist.queuedTurnId = undefined;
    session.assist.abortController = new AbortController();

    if (session.channel === "phone") {
      this.enqueueOutput(session, TWILIO_FILLER_PHRASE, "filler", queuedTurnId);
      void this.flushPhoneOutput(sessionId);
    }

    try {
      const response = await this.deps.agentClient.requestAssist(
        this.buildAssistPayload(session, queuedTurnId),
        session.assist.abortController.signal
      );

      if (session.status !== "active") {
        return;
      }

      if (response.turn_id !== session.assist.activeTurnId || session.assist.queuedTurnId !== undefined) {
        return;
      }

      Object.assign(session.metadata, response.metadata ?? {});
      this.appendTurn(session, "assistant", "assistant", response.say);

      this.enqueueOutput(session, response.say, "reply", response.turn_id);
      if (session.channel === "phone") {
        void this.flushPhoneOutput(sessionId);
      } else {
        await this.maybeSpeakMeetingOutput(sessionId);
      }

      if (response.should_end_session) {
        await this.transitionToEnding(sessionId, "agent_requested_end");
      }
    } catch (error) {
      if (session.assist.abortController?.signal.aborted || session.status !== "active") {
        return;
      }

      this.appendTurn(session, "assistant", "assistant", FALLBACK_REPLY);
      this.enqueueOutput(session, FALLBACK_REPLY, "fallback", queuedTurnId);

      if (session.channel === "phone") {
        void this.flushPhoneOutput(sessionId);
      } else {
        await this.maybeSpeakMeetingOutput(sessionId);
      }
    } finally {
      if (session.assist.activeTurnId === queuedTurnId) {
        session.assist.activeTurnId = undefined;
      }

      session.assist.inFlight = false;
      session.assist.abortController = undefined;

      if (session.status === "active" && session.assist.queuedTurnId) {
        await this.processNextAssistTurn(sessionId);
      }
    }
  }

  private async flushPhoneOutput(sessionId: string): Promise<void> {
    const session = this.deps.store.getSession(sessionId);
    const twilio = session?.provider.twilio;

    if (!session || !twilio || session.status !== "active" || session.output.activePlaybackId || session.output.queuedTts.length === 0) {
      return;
    }

    const item = session.output.queuedTts[0];
    session.output.activePlaybackId = item.id;

    try {
      const pcm = await this.deps.speechSynthesizer.synthesize(item.text);
      if (session.status === "active" && session.output.queuedTts[0]?.id === item.id) {
        twilio.mediaStream?.sendAudio(geminiToTwilio(pcm));
        emitServerEvent("bot_spoke", {
          sessionId,
          channel: "phone",
          text: item.text,
          answer: item.text,
        });
      }
    } finally {
      if (session.output.queuedTts[0]?.id === item.id) {
        session.output.queuedTts.shift();
      }

      if (session.output.activePlaybackId === item.id) {
        session.output.activePlaybackId = undefined;
      }

      if (session.status === "active" && session.output.queuedTts.length > 0) {
        await this.flushPhoneOutput(sessionId);
      }
    }
  }

  private async maybeSpeakMeetingOutput(sessionId: string): Promise<void> {
    const session = this.deps.store.getSession(sessionId);
    const recall = session?.provider.recall;

    if (
      !session ||
      !recall ||
      session.status !== "active" ||
      session.output.activePlaybackId ||
      session.output.queuedTts.length === 0
    ) {
      return;
    }

    const nextItem = session.output.queuedTts[0];
    if (getTurnSequence(recall.latestGapTurnId) < getTurnSequence(nextItem.turnId)) {
      return;
    }

    session.output.activePlaybackId = nextItem.id;

    try {
      const audio = await this.deps.speechSynthesizer.synthesize(nextItem.text);
      if (
        session.status === "active" &&
        session.output.queuedTts[0]?.id === nextItem.id &&
        recall.botId
      ) {
        await this.deps.sendMeetingAudio(recall.botId, audio);
        emitServerEvent("bot_spoke", {
          sessionId,
          botId: recall.botId,
          channel: "meeting",
          text: nextItem.text,
          answer: nextItem.text,
        });
      }
    } finally {
      if (session.output.queuedTts[0]?.id === nextItem.id) {
        session.output.queuedTts.shift();
      }

      if (session.output.activePlaybackId === nextItem.id) {
        session.output.activePlaybackId = undefined;
      }
    }
  }

  private async transitionToEnding(sessionId: string, reason: string): Promise<void> {
    const session = this.deps.store.getSession(sessionId);
    if (!session) {
      return;
    }

    if (session.status !== "active") {
      return;
    }

    session.status = "ending";
    session.endedReason = reason;
    session.endedAt = session.endedAt ?? new Date().toISOString();
    session.sessionEnd.pendingReason = reason;

    session.assist.abortController?.abort();
    session.assist.abortController = undefined;
    session.assist.inFlight = false;
    session.assist.activeTurnId = undefined;
    session.assist.queuedTurnId = undefined;

    session.output.queuedTts = [];
    session.output.activePlaybackId = undefined;

    session.provider.twilio?.sttSession?.close();
    session.provider.twilio && (session.provider.twilio.pendingAudio = Buffer.alloc(0));

    if (session.channel === "phone") {
      emitServerEvent("call_ended", {
        callId: session.sessionId,
        sessionId: session.sessionId,
        channel: session.channel,
        direction: "outbound",
        endReason: reason,
      });
    }

    await this.flushSessionEnd(sessionId);
  }

  private async flushSessionEnd(sessionId: string): Promise<void> {
    const session = this.deps.store.getSession(sessionId);
    if (
      !session ||
      session.status !== "ending" ||
      session.sessionEnd.acknowledged ||
      session.sessionEnd.inFlight
    ) {
      return;
    }

    if (!session.sessionEnd.pendingReason) {
      session.sessionEnd.pendingReason = session.endedReason ?? "session_ended";
    }

    session.sessionEnd.sent = true;
    session.sessionEnd.inFlight = true;

    try {
      const acknowledged = await this.deps.agentClient.sendSessionEnd({
        session_id: session.sessionId,
        channel: session.channel,
        full_transcript: session.transcript.map((turn) => ({ ...turn })),
        ended_reason: session.sessionEnd.pendingReason,
        metadata: this.buildSessionMetadata(session),
      });

      if (acknowledged) {
        session.sessionEnd.acknowledged = true;
        session.status = "ended";
        this.clearSessionEndRetry(session);
        this.finalizeSession(sessionId);
        return;
      }
    } catch {
      // Retry below.
    } finally {
      session.sessionEnd.inFlight = false;
    }

    session.sessionEnd.retryCount += 1;
    this.scheduleSessionEndRetry(sessionId);
  }

  private scheduleSessionEndRetry(sessionId: string): void {
    const session = this.deps.store.getSession(sessionId);
    if (
      !session ||
      session.status !== "ending" ||
      session.sessionEnd.acknowledged ||
      session.sessionEnd.retryTimer
    ) {
      return;
    }

    const delayMs = nextRetryDelay(session.sessionEnd.retryCount);
    session.sessionEnd.retryTimer = setTimeout(() => {
      const current = this.deps.store.getSession(sessionId);
      if (current) {
        current.sessionEnd.retryTimer = undefined;
      }

      void this.flushSessionEnd(sessionId);
    }, delayMs);
  }

  private clearSessionEndRetry(session: VoiceSessionBuffer): void {
    if (session.sessionEnd.retryTimer) {
      clearTimeout(session.sessionEnd.retryTimer);
      session.sessionEnd.retryTimer = undefined;
    }
  }

  private finalizeSession(sessionId: string): void {
    const session = this.deps.store.getSession(sessionId);
    if (!session) {
      return;
    }

    this.clearSessionEndRetry(session);
    session.provider.twilio?.sttSession?.close();
    session.provider.twilio?.mediaStream?.close();

    this.deps.store.archiveSession(sessionId);
  }
}

export const voiceCoordinator = new VoiceCoordinator({
  agentClient: mainAgentClient,
  speechSynthesizer: new GeminiSpeechSynthesizer(),
  store: new VoiceSessionStore(),
  createMeetingBot: createBot,
  leaveMeetingBot: removeBot,
  sendMeetingAudio: recallClient.sendAudioToMeeting,
  createSpeechTranscriber: () => new GeminiLiveTranscriber(),
});

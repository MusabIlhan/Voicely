import { EventEmitter } from "events";
import type {
  MeetingSession,
  MeetingBotStatus,
  TranscriptEntry,
} from "./types.js";
import { MeetingContextManager } from "./contextManager.js";
import { MeetingAI } from "./meetingAI.js";
import * as recallClient from "./recallClient.js";
import { onTranscript, onStatusChange } from "./webhooks.js";
import { emitServerEvent } from "../events.js";

// ---------------------------------------------------------------------------
// Meeting orchestrator — manages the full lifecycle of a meeting session:
//   join → listen → detect questions → respond via audio → leave
// ---------------------------------------------------------------------------

/** Minimum seconds between bot responses to avoid dominating the meeting. */
const DEFAULT_COOLDOWN_MS = 15_000;

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
  private ai: MeetingAI;
  private cooldownMs: number;
  /** Tracks when the bot last responded per session to enforce cooldown. */
  private lastResponseTime: Map<string, number> = new Map();
  /** Prevents concurrent response generation per session. */
  private responding: Set<string> = new Set();

  constructor(options: MeetingOrchestratorOptions = {}) {
    super();
    this.ai = new MeetingAI();
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;

    // Wire up global webhook listeners
    onTranscript((botId, entry) => this.handleTranscript(botId, entry));
    onStatusChange((botId, status) => this.handleStatusChange(botId, status));
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Create a Recall.ai bot and send it to join a meeting.
   * Initializes the context manager and AI brain for this session.
   */
  async joinMeeting(
    meetingUrl: string,
    botName?: string
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

    console.log(
      `[MeetingOrchestrator] Bot ${botResponse.id} created for meeting: ${meetingUrl}`
    );

    emitServerEvent("meeting_joined", {
      botId: botResponse.id,
      meetingUrl,
      status: session.status,
    });

    return { ...session };
  }

  /**
   * Remove a bot from a meeting (makes it leave).
   */
  async leaveMeeting(botId: string): Promise<void> {
    const session = this.sessions.get(botId);
    if (!session) {
      throw new Error(`No session found for bot ${botId}`);
    }

    try {
      await recallClient.removeBot(botId);
    } catch (err) {
      // Bot may already have left — log but don't throw
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[MeetingOrchestrator] Error removing bot ${botId}: ${msg}`
      );
    }

    this.updateSessionStatus(botId, "done");
    this.cleanupSession(botId);
  }

  /**
   * Get the current state of a meeting session.
   */
  getSession(botId: string): MeetingSession | undefined {
    const session = this.sessions.get(botId);
    return session ? { ...session } : undefined;
  }

  /**
   * Get all meeting sessions (active and past).
   */
  getAllSessions(): MeetingSession[] {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }

  /**
   * Get the full transcript for a meeting session.
   */
  getTranscript(botId: string): TranscriptEntry[] {
    const cm = this.contextManagers.get(botId);
    return cm ? cm.getTranscript() : [];
  }

  /**
   * Get an AI-generated summary for a meeting session.
   */
  getSummary(botId: string): string {
    const cm = this.contextManagers.get(botId);
    return cm ? cm.getSummary() : "No session found.";
  }

  // -------------------------------------------------------------------------
  // Webhook event handlers
  // -------------------------------------------------------------------------

  private handleTranscript(botId: string, entry: TranscriptEntry): void {
    const cm = this.contextManagers.get(botId);
    if (!cm) return;

    cm.addTranscriptEntry(entry);

    // Update the session's context window snapshot
    const session = this.sessions.get(botId);
    if (session) {
      session.participants = cm.getParticipants();
      session.contextWindow = cm.getTranscript();
    }

    emitServerEvent("transcript_update", {
      botId,
      speaker: entry.speaker,
      text: entry.text,
      timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : String(entry.timestamp),
    });

    // Check if the bot was mentioned / a question was directed at it
    if (cm.detectBotMention(entry)) {
      this.handleBotMention(botId, entry).catch((err) => {
        const error =
          err instanceof Error ? err : new Error(String(err));
        console.error(
          `[MeetingOrchestrator] Error handling mention in ${botId}: ${error.message}`
        );
        this.emit("error", botId, error);
      });
    }
  }

  private handleStatusChange(botId: string, status: MeetingBotStatus): void {
    const session = this.sessions.get(botId);
    if (!session) return;

    this.updateSessionStatus(botId, status);

    if (status === "done" || status === "error") {
      this.cleanupSession(botId);
    }
  }

  // -------------------------------------------------------------------------
  // AI response pipeline
  // -------------------------------------------------------------------------

  private async handleBotMention(
    botId: string,
    entry: TranscriptEntry
  ): Promise<void> {
    // Cooldown check
    const lastTime = this.lastResponseTime.get(botId) ?? 0;
    if (Date.now() - lastTime < this.cooldownMs) {
      console.log(
        `[MeetingOrchestrator] Cooldown active for bot ${botId}, skipping response`
      );
      return;
    }

    // Prevent concurrent responses
    if (this.responding.has(botId)) {
      console.log(
        `[MeetingOrchestrator] Already responding for bot ${botId}, skipping`
      );
      return;
    }

    this.responding.add(botId);

    try {
      const cm = this.contextManagers.get(botId);
      if (!cm) return;

      const meetingContext = cm.getContext();
      const question = entry.text;

      console.log(
        `[MeetingOrchestrator] Bot ${botId} mentioned — question: "${question}"`
      );

      // Get text response from AI
      const answer = await this.ai.handleQuestion(question, meetingContext);
      console.log(
        `[MeetingOrchestrator] Bot ${botId} answer: "${answer.substring(0, 100)}..."`
      );

      // Generate audio from the text response
      const audioBuffer = await this.ai.generateAudioResponse(answer);

      // Send audio back to the meeting via Recall.ai
      if (audioBuffer.length > 0) {
        await recallClient.sendAudioToMeeting(botId, audioBuffer);
        console.log(
          `[MeetingOrchestrator] Sent ${audioBuffer.length} bytes of audio to bot ${botId}`
        );
      } else {
        console.warn(
          `[MeetingOrchestrator] No audio generated for bot ${botId}`
        );
      }

      this.lastResponseTime.set(botId, Date.now());
      this.emit("response", botId, question, answer);

      emitServerEvent("bot_spoke", {
        botId,
        question,
        answer,
      });
    } finally {
      this.responding.delete(botId);
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private updateSessionStatus(
    botId: string,
    status: MeetingBotStatus
  ): void {
    const session = this.sessions.get(botId);
    if (!session) return;

    session.status = status;
    if (status === "done" || status === "error") {
      session.endedAt = new Date();
    }

    this.emit("statusChange", { ...session });
  }

  private cleanupSession(botId: string): void {
    // Keep session data for post-meeting reference but stop tracking live state
    this.responding.delete(botId);
    // Don't delete from sessions/contextManagers — we need them for summaries

    const session = this.sessions.get(botId);
    if (session) {
      this.emit("ended", { ...session });
    }

    console.log(`[MeetingOrchestrator] Session ${botId} cleaned up`);
  }
}

// Singleton instance
export const meetingOrchestrator = new MeetingOrchestrator();

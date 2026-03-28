import type {
  RecallSessionState,
  VoiceSessionArchive,
  VoiceSessionBuffer,
  VoiceTranscriptTurn,
} from "./types.js";

interface CreatePhoneSessionInput {
  sessionId: string;
  phoneNumber: string;
  metadata?: Record<string, unknown>;
}

interface CreateMeetingSessionInput {
  sessionId: string;
  meetingUrl: string;
  botName?: string;
  metadata?: Record<string, unknown>;
}

function cloneTurns(turns: VoiceTranscriptTurn[]): VoiceTranscriptTurn[] {
  return turns.map((turn) => ({ ...turn }));
}

function cloneRecallState(state: RecallSessionState | undefined): RecallSessionState | undefined {
  return state ? { ...state } : undefined;
}

function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return { ...metadata };
}

function toArchive(session: VoiceSessionBuffer): VoiceSessionArchive {
  return {
    sessionId: session.sessionId,
    channel: session.channel,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    endedReason: session.endedReason,
    status: "ended",
    transcript: cloneTurns(session.transcript),
    metadata: cloneMetadata(session.metadata),
    provider: {
      twilio: session.provider.twilio
        ? {
            phoneNumber: session.provider.twilio.phoneNumber,
            callSid: session.provider.twilio.callSid,
            streamSid: session.provider.twilio.streamSid,
          }
        : undefined,
      recall: cloneRecallState(session.provider.recall),
    },
  };
}

export class VoiceSessionStore {
  private readonly liveSessions = new Map<string, VoiceSessionBuffer>();
  private readonly botToSessionId = new Map<string, string>();
  private readonly archivedSessions: VoiceSessionArchive[] = [];

  createPhoneSession(input: CreatePhoneSessionInput): VoiceSessionBuffer {
    const existing = this.liveSessions.get(input.sessionId);
    if (existing) {
      return existing;
    }

    const session: VoiceSessionBuffer = {
      sessionId: input.sessionId,
      channel: "phone",
      startedAt: new Date().toISOString(),
      status: "active",
      transcript: [],
      metadata: cloneMetadata(input.metadata ?? {}),
      assist: {
        inFlight: false,
      },
      output: {
        queuedTts: [],
      },
      provider: {
        twilio: {
          phoneNumber: input.phoneNumber,
        },
      },
      sessionEnd: {
        sent: false,
        acknowledged: false,
        retryCount: 0,
      },
      turnCounter: 0,
    };

    this.liveSessions.set(input.sessionId, session);
    return session;
  }

  createMeetingSession(input: CreateMeetingSessionInput): VoiceSessionBuffer {
    const existing = this.liveSessions.get(input.sessionId);
    if (existing) {
      return existing;
    }

    const session: VoiceSessionBuffer = {
      sessionId: input.sessionId,
      channel: "meeting",
      startedAt: new Date().toISOString(),
      status: "active",
      transcript: [],
      metadata: cloneMetadata(input.metadata ?? {}),
      assist: {
        inFlight: false,
      },
      output: {
        queuedTts: [],
      },
      provider: {
        recall: {
          meetingUrl: input.meetingUrl,
          botName: input.botName,
          lifecycle: "joining",
        },
      },
      sessionEnd: {
        sent: false,
        acknowledged: false,
        retryCount: 0,
      },
      turnCounter: 0,
    };

    this.liveSessions.set(input.sessionId, session);
    return session;
  }

  getSession(sessionId: string): VoiceSessionBuffer | undefined {
    return this.liveSessions.get(sessionId);
  }

  getSessionSnapshot(sessionId: string): VoiceSessionBuffer | VoiceSessionArchive | undefined {
    return this.liveSessions.get(sessionId) ?? this.archivedSessions.find((session) => session.sessionId === sessionId);
  }

  getAllSessions(): VoiceSessionBuffer[] {
    return Array.from(this.liveSessions.values());
  }

  getArchivedSessions(): VoiceSessionArchive[] {
    return [...this.archivedSessions];
  }

  linkBot(sessionId: string, botId: string): VoiceSessionBuffer {
    const session = this.requireSession(sessionId);
    if (!session.provider.recall) {
      throw new Error(`Session ${sessionId} does not have Recall state`);
    }

    session.provider.recall.botId = botId;
    this.botToSessionId.set(botId, sessionId);
    return session;
  }

  unlinkBot(botId: string): void {
    this.botToSessionId.delete(botId);
  }

  getSessionByBotId(botId: string): VoiceSessionBuffer | undefined {
    const sessionId = this.botToSessionId.get(botId);
    return sessionId ? this.liveSessions.get(sessionId) : undefined;
  }

  getArchivedSessionByBotId(botId: string): VoiceSessionArchive | undefined {
    return this.archivedSessions.find((session) => session.provider.recall?.botId === botId);
  }

  getSessionIdByBotId(botId: string): string | undefined {
    return this.botToSessionId.get(botId);
  }

  archiveSession(sessionId: string): VoiceSessionArchive {
    const session = this.requireSession(sessionId);
    const archived = toArchive(session);

    if (session.provider.recall?.botId) {
      this.botToSessionId.delete(session.provider.recall.botId);
    }

    this.liveSessions.delete(sessionId);
    this.archivedSessions.unshift(archived);
    return archived;
  }

  requireSession(sessionId: string): VoiceSessionBuffer {
    const session = this.liveSessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown voice session: ${sessionId}`);
    }

    return session;
  }
}

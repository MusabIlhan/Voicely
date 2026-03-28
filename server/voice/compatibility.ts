import type {
  CompatibilityCallSession,
  CompatibilityMeetingParticipant,
  CompatibilityMeetingSession,
  CompatibilityTranscriptEntry,
  VoiceSessionArchive,
  VoiceSessionBuffer,
  VoiceTranscriptTurn,
} from "./types.js";

type SessionSnapshot = VoiceSessionBuffer | VoiceSessionArchive;

function normalizeSpeakerId(speaker: string, index: number): string {
  const normalized = speaker
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : `speaker-${index + 1}`;
}

function collectParticipants(turns: VoiceTranscriptTurn[]): CompatibilityMeetingParticipant[] {
  const participants = new Map<string, CompatibilityMeetingParticipant>();

  turns.forEach((turn, index) => {
    if (turn.role !== "user") {
      return;
    }

    if (!participants.has(turn.speaker)) {
      participants.set(turn.speaker, {
        name: turn.speaker,
        speakerId: normalizeSpeakerId(turn.speaker, index),
      });
    }
  });

  return Array.from(participants.values());
}

function mapCallStatus(session: SessionSnapshot): CompatibilityCallSession["status"] {
  if (session.status !== "active") {
    return "ended";
  }

  if (!session.provider.twilio?.callSid || !session.provider.twilio.streamSid) {
    return "connecting";
  }

  return "active";
}

function mapMeetingStatus(session: SessionSnapshot): CompatibilityMeetingSession["status"] {
  const lifecycle = session.provider.recall?.lifecycle;

  if (session.status === "active") {
    if (lifecycle === "in_call") {
      return "in_call";
    }

    return "joining";
  }

  if (lifecycle === "error" || session.endedReason?.includes("error")) {
    return "error";
  }

  return "done";
}

function summarizeRecentTurns(turns: VoiceTranscriptTurn[]): string[] {
  return turns
    .filter((turn) => turn.text.trim().length > 0)
    .slice(-5)
    .map((turn) => `${turn.speaker}: ${turn.text.trim()}`);
}

function formatDuration(startedAt: string, endedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainderSeconds}s`;
  }

  return `${remainderSeconds}s`;
}

export function projectCallSession(session: SessionSnapshot): CompatibilityCallSession {
  if (session.channel !== "phone") {
    throw new Error(`Session ${session.sessionId} is not a phone session`);
  }

  return {
    id: session.sessionId,
    sessionId: session.sessionId,
    twilioCallSid: session.provider.twilio?.callSid ?? "",
    status: mapCallStatus(session),
    direction: "outbound",
    purpose: typeof session.metadata.purpose === "string" ? session.metadata.purpose : undefined,
    outcome: session.endedReason,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  };
}

export function projectMeetingSession(session: SessionSnapshot): CompatibilityMeetingSession {
  if (session.channel !== "meeting") {
    throw new Error(`Session ${session.sessionId} is not a meeting session`);
  }

  return {
    sessionId: session.sessionId,
    botId: session.provider.recall?.botId ?? session.sessionId,
    meetingUrl: session.provider.recall?.meetingUrl ?? "",
    status: mapMeetingStatus(session),
    participants: collectParticipants(session.transcript),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  };
}

export function projectTranscriptEntries(session: SessionSnapshot): CompatibilityTranscriptEntry[] {
  return session.transcript.map((turn) => ({
    speaker: turn.speaker,
    text: turn.text,
    timestamp: turn.timestamp,
    isBotSpeech: turn.role === "assistant",
  }));
}

export function buildMeetingSummary(session: SessionSnapshot): string {
  if (session.channel !== "meeting") {
    throw new Error(`Session ${session.sessionId} is not a meeting session`);
  }

  const participants = collectParticipants(session.transcript).map((participant) => participant.name);
  const recentTurns = summarizeRecentTurns(session.transcript);

  if (recentTurns.length === 0) {
    return "No transcript is available for this meeting yet.";
  }

  const sections = [
    `Meeting URL: ${session.provider.recall?.meetingUrl ?? "unknown"}`,
    `Duration: ${formatDuration(session.startedAt, session.endedAt)}`,
    `Participants: ${participants.length > 0 ? participants.join(", ") : "None detected yet"}`,
    `Transcript turns: ${session.transcript.length}`,
    "Recent discussion:",
    ...recentTurns.map((turn) => `- ${turn}`),
  ];

  return sections.join("\n");
}

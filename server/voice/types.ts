import type { TwilioMediaStream } from "../twilio/mediaStream.js";
import type { SpeechTranscriber } from "./geminiTranscriber.js";

export type VoiceChannel = "phone" | "meeting";

export type VoiceSessionStatus = "active" | "ending" | "ended";

export type VoiceTurnRole = "user" | "assistant" | "system";

export type RecallLifecycle = "joining" | "in_call" | "done" | "error";

export interface VoiceTranscriptTurn {
  turn_id: string;
  role: VoiceTurnRole;
  speaker: string;
  text: string;
  timestamp: string;
}

export interface TtsItem {
  id: string;
  text: string;
  kind: "filler" | "reply" | "fallback";
  queuedAt: string;
  turnId?: string;
}

export interface VoiceSessionAssistState {
  inFlight: boolean;
  activeTurnId?: string;
  queuedTurnId?: string;
  abortController?: AbortController;
}

export interface VoiceSessionOutputState {
  queuedTts: TtsItem[];
  activePlaybackId?: string;
}

export interface TwilioSessionState {
  phoneNumber: string;
  callSid?: string;
  streamSid?: string;
  mediaStream?: TwilioMediaStream;
  sttSession?: SpeechTranscriber;
  pendingAudio?: Buffer;
}

export interface RecallSessionState {
  meetingUrl: string;
  botId?: string;
  botName?: string;
  lifecycle: RecallLifecycle;
  latestGapTurnId?: string;
}

export interface VoiceSessionEndState {
  sent: boolean;
  acknowledged: boolean;
  retryCount: number;
  pendingReason?: string;
  inFlight?: boolean;
  retryTimer?: NodeJS.Timeout;
}

export interface VoiceSessionBuffer {
  sessionId: string;
  channel: VoiceChannel;
  startedAt: string;
  endedAt?: string;
  endedReason?: string;
  status: VoiceSessionStatus;
  transcript: VoiceTranscriptTurn[];
  metadata: Record<string, unknown>;
  assist: VoiceSessionAssistState;
  output: VoiceSessionOutputState;
  provider: {
    twilio?: TwilioSessionState;
    recall?: RecallSessionState;
  };
  sessionEnd: VoiceSessionEndState;
  turnCounter: number;
}

export interface ArchivedTwilioSessionState {
  phoneNumber: string;
  callSid?: string;
  streamSid?: string;
}

export interface VoiceSessionArchive {
  sessionId: string;
  channel: VoiceChannel;
  startedAt: string;
  endedAt?: string;
  endedReason?: string;
  status: "ended";
  transcript: VoiceTranscriptTurn[];
  metadata: Record<string, unknown>;
  provider: {
    twilio?: ArchivedTwilioSessionState;
    recall?: RecallSessionState;
  };
}

export interface AssistRequestPayload {
  session_id: string;
  turn_id: string;
  channel: VoiceChannel;
  recent_turns: VoiceTranscriptTurn[];
  metadata: Record<string, unknown>;
}

export interface AssistResponse {
  turn_id: string;
  say: string;
  should_end_session: boolean;
  metadata?: Record<string, unknown>;
}

export interface SessionEndPayload {
  session_id: string;
  channel: VoiceChannel;
  full_transcript: VoiceTranscriptTurn[];
  ended_reason: string;
  metadata: Record<string, unknown>;
}

export interface CompatibilityCallSession {
  id: string;
  sessionId: string;
  twilioCallSid: string;
  status: "connecting" | "active" | "ended";
  direction: "outbound";
  purpose?: string;
  outcome?: string;
  startedAt: string;
  endedAt?: string;
}

export interface CompatibilityMeetingParticipant {
  name: string;
  speakerId: string;
}

export type CompatibilityMeetingStatus =
  | "creating"
  | "joining"
  | "in_call"
  | "done"
  | "error";

export interface CompatibilityMeetingSession {
  sessionId: string;
  botId: string;
  meetingUrl: string;
  status: CompatibilityMeetingStatus;
  participants: CompatibilityMeetingParticipant[];
  startedAt: string;
  endedAt?: string;
}

export interface CompatibilityTranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
  isBotSpeech?: boolean;
}

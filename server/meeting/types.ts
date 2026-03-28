import type { GeminiLiveSession } from "../gemini/liveClient.js";

export type MeetingBotStatus =
  | "creating"
  | "joining"
  | "in_call"
  | "leaving"
  | "done"
  | "error";

export interface MeetingSession {
  botId: string;
  meetingUrl: string;
  status: MeetingBotStatus;
  participants: MeetingParticipant[];
  startedAt: Date;
  endedAt?: Date;
  contextWindow: TranscriptEntry[];
}

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: Date;
}

export interface MeetingParticipant {
  name: string;
  speakerId: string;
}

export interface RecallBotResponse {
  id: string;
  status_changes: RecallStatusChange[];
  meeting_url: string;
}

export interface RecallStatusChange {
  code: string;
  message: string;
  created_at: string;
}

export interface RecallRealtimeEndpointConfig {
  type: "websocket" | "webhook";
  url: string;
  events: string[];
}

export interface RecallAutomaticAudioOutputConfig {
  in_call_recording: {
    data: {
      kind: "mp3";
      b64_data: string;
    };
  };
}

export interface RecallBotConfig {
  meeting_url: string;
  bot_name?: string;
  recording_config?: {
    audio_mixed_raw?: Record<string, never>;
    realtime_endpoints?: RecallRealtimeEndpointConfig[];
  };
  automatic_audio_output?: RecallAutomaticAudioOutputConfig;
  chat?: {
    on_bot_join?: {
      send_to: string;
      message: string;
    };
  };
}

export interface RecallRealtimeBotRef {
  id: string;
}

export interface RecallParticipantRef {
  id?: string;
  name?: string;
}

export interface RecallAudioMixedRawDataEvent {
  event: "audio_mixed_raw.data";
  data: {
    bot: RecallRealtimeBotRef;
    data: {
      buffer: string;
      mime_type?: string;
    };
  };
}

export interface RecallParticipantSpeechEvent {
  event: "participant_events.speech_on" | "participant_events.speech_off";
  data: {
    bot: RecallRealtimeBotRef;
    participant?: RecallParticipantRef;
  };
}

export type RecallRealtimeEvent =
  | RecallAudioMixedRawDataEvent
  | RecallParticipantSpeechEvent;

export interface MeetingAudioSessionState {
  botId: string;
  geminiSession: GeminiLiveSession;
  recallAudioConnected: boolean;
  geminiConnected: boolean;
  wakeActiveUntil: number;
  suppressIncomingAudioUntil: number;
  currentTurnActive: boolean;
  currentTurnAccepted: boolean;
  currentTurnHadWakeWord: boolean;
  currentTurnInputTexts: string[];
  currentTurnOutputTexts: string[];
  currentTurnOutputAudio: Buffer[];
  speaking: boolean;
}

// --- Meeting Session ---

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

// --- Transcript ---

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: Date;
}

// --- Participant ---

export interface MeetingParticipant {
  name: string;
  speakerId: string;
}

// --- Recall.ai API Response Types ---

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

export interface RecallBotConfig {
  meeting_url: string;
  bot_name?: string;
  real_time_transcription?: {
    destination_url: string;
  };
  transcription_options?: {
    provider: string;
  };
  recording_mode?: string;
  chat?: {
    on_bot_join?: {
      send_to: string;
      message: string;
    };
  };
}

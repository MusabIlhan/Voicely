// --- Call Session ---

export type CallStatus = "connecting" | "active" | "ended";

export type CallDirection = "inbound" | "outbound";

export interface CallSession {
  id: string;
  twilioCallSid: string;
  status: CallStatus;
  direction: CallDirection;
  purpose?: string;
  outcome?: string;
  startedAt: Date;
  endedAt?: Date;
}

// --- Twilio Media Stream Messages ---

export interface TwilioConnectedMessage {
  event: "connected";
  protocol: string;
  version: string;
}

export interface TwilioStartMessage {
  event: "start";
  sequenceNumber: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  streamSid: string;
}

export interface TwilioMediaMessage {
  event: "media";
  sequenceNumber: string;
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // base64-encoded audio
  };
  streamSid: string;
}

export interface TwilioStopMessage {
  event: "stop";
  sequenceNumber: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
  streamSid: string;
}

export interface TwilioMarkMessage {
  event: "mark";
  sequenceNumber: string;
  mark: {
    name: string;
  };
  streamSid: string;
}

export type TwilioStreamMessage =
  | TwilioConnectedMessage
  | TwilioStartMessage
  | TwilioMediaMessage
  | TwilioStopMessage
  | TwilioMarkMessage;

// --- Bridge Server Status ---

export interface BridgeServerStatus {
  activeCalls: number;
  uptime: number;
  configuredServices: {
    twilio: boolean;
    gemini: boolean;
    googleCalendar: boolean;
  };
  mcp: {
    configured: boolean;
    tools: number;
    resources: number;
  };
}

// --- Gemini Configuration ---

export interface GeminiConfig {
  model: string;
  systemInstruction: string;
  voice: string;
  tools?: GeminiToolConfig[];
}

export interface GeminiToolConfig {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

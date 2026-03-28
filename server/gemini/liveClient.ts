import { EventEmitter } from "events";
import {
  GoogleGenAI,
  Modality,
  Session,
  type LiveServerMessage,
  type LiveServerToolCall,
  type LiveConnectConfig,
  type FunctionResponse,
} from "@google/genai";
import { config } from "@server/config";
import type { GeminiConfig } from "../../shared/types";

const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  model: "gemini-live-2.5-flash-preview",
  systemInstruction:
    "You are Voisli, a helpful AI voice assistant. You help users make phone calls, reservations, and manage their schedule. Be conversational, concise, and friendly. Keep responses short since this is a voice conversation.",
  voice: "Aoede",
};

const AUDIO_MIME_TYPE = "audio/pcm;rate=16000";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1000;

export interface GeminiLiveSessionEvents {
  audio: (pcmAudio: Buffer) => void;
  text: (text: string) => void;
  toolCall: (toolCall: LiveServerToolCall) => void;
  interrupted: () => void;
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
}

export class GeminiLiveSession extends EventEmitter {
  private session: Session | null = null;
  private genAI: GoogleGenAI;
  private geminiConfig: GeminiConfig;
  private connected = false;
  private reconnectAttempts = 0;
  private closing = false;

  constructor(geminiConfig?: Partial<GeminiConfig>) {
    super();
    this.geminiConfig = { ...DEFAULT_GEMINI_CONFIG, ...geminiConfig };
    this.genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }

  /**
   * Establishes a WebSocket session with the Gemini Live API.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.warn("[Gemini] Already connected, ignoring connect() call");
      return;
    }

    this.closing = false;

    const liveConfig: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.geminiConfig.voice,
          },
        },
      },
      systemInstruction: this.geminiConfig.systemInstruction,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    };

    if (this.geminiConfig.tools && this.geminiConfig.tools.length > 0) {
      liveConfig.tools = [
        {
          functionDeclarations: this.geminiConfig.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    try {
      console.log(
        `[Gemini] Connecting to model: ${this.geminiConfig.model}...`
      );

      this.session = await this.genAI.live.connect({
        model: this.geminiConfig.model,
        config: liveConfig,
        callbacks: {
          onopen: () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            console.log("[Gemini] Session established");
            this.emit("connected");
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleServerMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            console.error(`[Gemini] WebSocket error: ${e.message ?? e}`);
            this.emit("error", new Error(`Gemini WebSocket error: ${e.message ?? "unknown"}`));
          },
          onclose: () => {
            const wasConnected = this.connected;
            this.connected = false;
            this.session = null;
            console.log("[Gemini] Session closed");

            if (wasConnected && !this.closing) {
              this.emit("disconnected");
              this.attemptReconnect();
            } else {
              this.emit("disconnected");
            }
          },
        },
      });
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error(String(err));
      console.error(`[Gemini] Failed to connect: ${error.message}`);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Sends PCM audio data to the Gemini Live session.
   * @param pcmAudio - 16-bit PCM audio buffer at 16kHz mono
   */
  sendAudio(pcmAudio: Buffer): void {
    if (!this.session || !this.connected) {
      return;
    }

    const base64Audio = pcmAudio.toString("base64");

    this.session.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: AUDIO_MIME_TYPE,
      },
    });
  }

  /**
   * Sends function/tool responses back to Gemini so it can continue the conversation.
   * Call this after executing the tool calls received via the `toolCall` event.
   */
  sendToolResponse(functionResponses: FunctionResponse[]): void {
    if (!this.session || !this.connected) {
      console.warn("[Gemini] Cannot send tool response — not connected");
      return;
    }

    console.log(
      `[Gemini] Sending tool responses: ${functionResponses.map((r) => r.name).join(", ")}`
    );

    this.session.sendToolResponse({ functionResponses });
  }

  /**
   * Register a callback for receiving audio output from Gemini.
   */
  onAudio(callback: (pcmAudio: Buffer) => void): void {
    this.on("audio", callback);
  }

  /**
   * Register a callback for receiving text transcription from Gemini.
   */
  onText(callback: (text: string) => void): void {
    this.on("text", callback);
  }

  /**
   * Register a callback for tool/function calls from Gemini.
   */
  onToolCall(callback: (toolCall: LiveServerToolCall) => void): void {
    this.on("toolCall", callback);
  }

  /**
   * Register a callback for when the model is interrupted (barge-in).
   */
  onInterrupted(callback: () => void): void {
    this.on("interrupted", callback);
  }

  /**
   * Cleanly disconnect from the Gemini Live session.
   */
  close(): void {
    this.closing = true;

    if (this.session) {
      try {
        this.session.close();
      } catch {
        // Ignore errors during close
      }
      this.session = null;
    }

    this.connected = false;
    console.log("[Gemini] Session closed by client");
  }

  /** Whether the session is currently connected. */
  isConnected(): boolean {
    return this.connected;
  }

  private handleServerMessage(message: LiveServerMessage): void {
    // Handle setup complete
    if (message.setupComplete) {
      console.log("[Gemini] Setup complete, ready for audio");
      return;
    }

    // Handle server content (audio/text responses)
    if (message.serverContent) {
      const content = message.serverContent;

      // Handle interruption
      if (content.interrupted) {
        console.log("[Gemini] Model generation interrupted (barge-in)");
        this.emit("interrupted");
      }

      // Extract audio data from model turn
      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) {
            const audioBuffer = Buffer.from(part.inlineData.data, "base64");
            this.emit("audio", audioBuffer);
          }
        }
      }

      // Handle input transcription
      if (content.inputTranscription?.text) {
        this.emit("text", `[user] ${content.inputTranscription.text}`);
      }

      // Handle output transcription
      if (content.outputTranscription?.text) {
        this.emit("text", `[assistant] ${content.outputTranscription.text}`);
      }

      if (content.turnComplete) {
        console.log("[Gemini] Turn complete");
      }

      return;
    }

    // Handle tool calls
    if (message.toolCall) {
      console.log(
        `[Gemini] Tool call received: ${message.toolCall.functionCalls?.map((fc) => fc.name).join(", ")}`
      );
      this.emit("toolCall", message.toolCall);
      return;
    }

    // Handle tool call cancellation
    if (message.toolCallCancellation) {
      console.log("[Gemini] Tool call cancelled");
      return;
    }

    // Handle go away (server disconnecting)
    if (message.goAway) {
      console.warn(
        `[Gemini] Server going away, time left: ${message.goAway.timeLeft}`
      );
      return;
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.closing || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(
          `[Gemini] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
        );
        this.emit(
          "error",
          new Error("Max reconnect attempts reached")
        );
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
    console.log(
      `[Gemini] Attempting reconnect ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this.closing) return;

    try {
      await this.connect();
    } catch {
      // connect() already logs and emits error; attemptReconnect will be
      // triggered again via the onclose callback if the connection fails
    }
  }
}

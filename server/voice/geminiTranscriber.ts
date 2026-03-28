import { EventEmitter } from "events";
import {
  GoogleGenAI,
  Modality,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { config } from "../config.js";

const TRANSCRIBER_MODEL = "gemini-live-2.5-flash-preview";
const AUDIO_MIME_TYPE = "audio/pcm;rate=16000";
const TRANSCRIBER_PROMPT =
  "You are a speech transcription service. Transcribe the caller's spoken words accurately. Do not answer questions. Do not generate assistant replies.";

export interface SpeechTranscriber {
  connect(): Promise<void>;
  sendAudio(pcm16Audio: Buffer): void;
  close(): void;
  onFinalTranscript(callback: (text: string) => void): void;
  onError(callback: (error: Error) => void): void;
}

export class GeminiLiveTranscriber extends EventEmitter implements SpeechTranscriber {
  private session: Session | null = null;
  private readonly genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  private connected = false;
  private closing = false;
  private pendingTranscript = "";

  async connect(): Promise<void> {
    if (this.connected || this.session) {
      return;
    }

    this.closing = false;

    const liveConfig: LiveConnectConfig = {
      responseModalities: [Modality.TEXT],
      systemInstruction: TRANSCRIBER_PROMPT,
      inputAudioTranscription: {},
    };

    try {
      this.session = await this.genAI.live.connect({
        model: TRANSCRIBER_MODEL,
        config: liveConfig,
        callbacks: {
          onopen: () => {
            this.connected = true;
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleServerMessage(message);
          },
          onerror: (event: ErrorEvent) => {
            const error = new Error(event.message ?? "Gemini transcriber websocket error");
            this.emit("error", error);
          },
          onclose: () => {
            this.connected = false;
            this.session = null;
            if (!this.closing) {
              this.emit("error", new Error("Gemini transcriber connection closed unexpectedly"));
            }
          },
        },
      });
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.connected = false;
      this.session = null;
      this.emit("error", normalized);
      throw normalized;
    }
  }

  sendAudio(pcm16Audio: Buffer): void {
    if (!this.connected || !this.session || pcm16Audio.length === 0) {
      return;
    }

    this.session.sendRealtimeInput({
      audio: {
        data: pcm16Audio.toString("base64"),
        mimeType: AUDIO_MIME_TYPE,
      },
    });
  }

  close(): void {
    this.closing = true;
    this.pendingTranscript = "";

    if (this.session) {
      try {
        this.session.close();
      } catch {
        // Ignore close failures during teardown.
      }
    }

    this.session = null;
    this.connected = false;
  }

  onFinalTranscript(callback: (text: string) => void): void {
    this.on("finalTranscript", callback);
  }

  onError(callback: (error: Error) => void): void {
    this.on("error", callback);
  }

  private handleServerMessage(message: LiveServerMessage): void {
    const content = message.serverContent;
    if (!content) {
      return;
    }

    if (typeof content.inputTranscription?.text === "string") {
      this.pendingTranscript = content.inputTranscription.text;
    }

    if (content.turnComplete) {
      const finalized = this.pendingTranscript.trim();
      this.pendingTranscript = "";
      if (finalized.length > 0) {
        this.emit("finalTranscript", finalized);
      }
    }
  }
}

import { EventEmitter } from "events";
import type WebSocket from "ws";
import { TwilioMediaStream } from "./twilio/mediaStream";
import { GeminiLiveSession } from "./gemini/liveClient";
import { twilioToGemini, geminiToTwilio } from "./audio/converter";
import { executeToolCalls } from "./tools/executor";
import { allToolSchemas } from "./tools/schema";
import { getSystemPrompt, type CallContext } from "./gemini/prompts";
import type { CallSession, CallStatus, CallDirection } from "../shared/types";

// Minimum audio chunk size (in bytes) to send to Gemini.
// Gemini Live API works best with chunks of at least ~4000 bytes of PCM 16kHz.
const MIN_AUDIO_CHUNK_BYTES = 4000;

export interface CallOrchestratorOptions {
  direction?: CallDirection;
  context?: CallContext;
  purpose?: string;
}

export interface CallOrchestratorEvents {
  statusChange: (session: CallSession) => void;
  ended: (session: CallSession) => void;
  error: (error: Error) => void;
}

export class CallOrchestrator extends EventEmitter {
  private twilioStream: TwilioMediaStream;
  private geminiSession: GeminiLiveSession;
  private session: CallSession;
  private audioBuffer: Buffer = Buffer.alloc(0);
  private cleanedUp = false;

  constructor(twilioWs: WebSocket, options: CallOrchestratorOptions = {}) {
    super();

    const direction = options.direction ?? "inbound";
    const context = options.context ?? "inbound";
    const systemInstruction = getSystemPrompt(context, options.purpose);

    this.session = {
      id: crypto.randomUUID(),
      twilioCallSid: "",
      status: "connecting",
      direction,
      purpose: options.purpose,
      startedAt: new Date(),
    };

    this.twilioStream = new TwilioMediaStream(twilioWs);
    this.geminiSession = new GeminiLiveSession({
      tools: allToolSchemas,
      systemInstruction,
    });

    this.wireUpTwilio();
    this.wireUpGemini();
  }

  private wireUpTwilio(): void {
    this.twilioStream.on("start", ({ callSid }) => {
      this.session.twilioCallSid = callSid;
      console.log(`[Orchestrator] Call started — callSid: ${callSid}, sessionId: ${this.session.id}`);

      // Connect to Gemini once Twilio stream is ready
      this.geminiSession.connect().catch((err) => {
        console.error(`[Orchestrator] Failed to connect to Gemini: ${err.message}`);
        this.emit("error", err);
        this.cleanup();
      });
    });

    this.twilioStream.on("audio", (base64MulawAudio: string) => {
      // Convert Twilio audio (mulaw 8kHz) → Gemini (PCM 16kHz) and send
      const pcm16k = twilioToGemini(base64MulawAudio);

      // Buffer audio to meet minimum chunk size for Gemini
      this.audioBuffer = Buffer.concat([this.audioBuffer, pcm16k]);

      if (this.audioBuffer.length >= MIN_AUDIO_CHUNK_BYTES) {
        this.geminiSession.sendAudio(this.audioBuffer);
        this.audioBuffer = Buffer.alloc(0);
      }
    });

    this.twilioStream.on("stop", () => {
      console.log(`[Orchestrator] Twilio stream stopped for call ${this.session.twilioCallSid}`);
      this.cleanup();
    });

    this.twilioStream.on("error", (err: Error) => {
      console.error(`[Orchestrator] Twilio error: ${err.message}`);
      this.emit("error", err);
    });
  }

  private wireUpGemini(): void {
    this.geminiSession.on("connected", () => {
      this.updateStatus("active");
      console.log(`[Orchestrator] Gemini connected — call is now active`);

      // Flush any buffered audio
      if (this.audioBuffer.length > 0) {
        this.geminiSession.sendAudio(this.audioBuffer);
        this.audioBuffer = Buffer.alloc(0);
      }
    });

    this.geminiSession.onAudio((pcm16k: Buffer) => {
      // Convert Gemini audio (PCM 16kHz) → Twilio (mulaw 8kHz base64)
      const base64Mulaw = geminiToTwilio(pcm16k);
      this.twilioStream.sendAudio(base64Mulaw);
    });

    this.geminiSession.onText((text: string) => {
      console.log(`[Orchestrator] Transcript: ${text}`);
    });

    this.geminiSession.onToolCall((toolCall) => {
      const calls = toolCall.functionCalls ?? [];
      console.log(
        `[Orchestrator] Tool call(s) received: ${calls.map((fc) => fc.name).join(", ")}`
      );

      executeToolCalls(calls)
        .then((responses) => {
          this.geminiSession.sendToolResponse(responses);
        })
        .catch((err) => {
          console.error(`[Orchestrator] Tool execution failed: ${err.message}`);
          this.emit("error", err);
        });
    });

    this.geminiSession.onInterrupted(() => {
      console.log(`[Orchestrator] Gemini interrupted (barge-in) for call ${this.session.twilioCallSid}`);
    });

    this.geminiSession.on("disconnected", () => {
      console.log(`[Orchestrator] Gemini disconnected for call ${this.session.twilioCallSid}`);
      // If Gemini disconnects and we can't reconnect, end the call
      if (this.session.status === "active") {
        this.cleanup();
      }
    });

    this.geminiSession.on("error", (err: Error) => {
      console.error(`[Orchestrator] Gemini error: ${err.message}`);
      this.emit("error", err);
    });
  }

  private updateStatus(status: CallStatus): void {
    this.session.status = status;
    if (status === "ended") {
      this.session.endedAt = new Date();
    }
    this.emit("statusChange", { ...this.session });
  }

  private cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    console.log(`[Orchestrator] Cleaning up call ${this.session.twilioCallSid || this.session.id}`);

    this.geminiSession.close();
    this.twilioStream.close();

    this.updateStatus("ended");
    this.emit("ended", { ...this.session });
  }

  getSession(): CallSession {
    return { ...this.session };
  }
}

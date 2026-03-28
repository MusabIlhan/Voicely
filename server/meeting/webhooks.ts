import { Router, Request, Response } from "express";
import type { MeetingBotStatus, TranscriptEntry } from "./types.js";

// ---------------------------------------------------------------------------
// Recall.ai webhook routes
//
// These routes receive real-time events from Recall.ai:
// - Transcript events (speech-to-text from meeting participants)
// - Bot status changes (joining, in_call, done, etc.)
// - Audio data (if using audio-based processing)
// ---------------------------------------------------------------------------

const router = Router();

// ---------------------------------------------------------------------------
// Event emitter pattern — consumers register callbacks to react to events
// ---------------------------------------------------------------------------

type TranscriptCallback = (botId: string, entry: TranscriptEntry) => void;
type StatusCallback = (botId: string, status: MeetingBotStatus) => void;
type AudioCallback = (botId: string, audioData: Buffer) => void;

const transcriptListeners: TranscriptCallback[] = [];
const statusListeners: StatusCallback[] = [];
const audioListeners: AudioCallback[] = [];

export function onTranscript(cb: TranscriptCallback): void {
  transcriptListeners.push(cb);
}

export function onStatusChange(cb: StatusCallback): void {
  statusListeners.push(cb);
}

export function onAudio(cb: AudioCallback): void {
  audioListeners.push(cb);
}

/**
 * Remove all registered listeners. Useful for testing.
 */
export function clearListeners(): void {
  transcriptListeners.length = 0;
  statusListeners.length = 0;
  audioListeners.length = 0;
}

// ---------------------------------------------------------------------------
// Map Recall.ai status codes to our internal MeetingBotStatus
// ---------------------------------------------------------------------------

function mapRecallStatus(code: string): MeetingBotStatus {
  const mapping: Record<string, MeetingBotStatus> = {
    ready: "creating",
    joining_call: "joining",
    in_waiting_room: "joining",
    in_call_not_recording: "in_call",
    in_call_recording: "in_call",
    call_ended: "done",
    done: "done",
    fatal: "error",
    analysis_done: "done",
  };
  return mapping[code] ?? "error";
}

// ---------------------------------------------------------------------------
// POST /webhooks/recall/transcript
// Receives real-time transcript events from Recall.ai.
//
// Expected payload shape (Recall.ai real-time transcription):
// {
//   "bot_id": "...",
//   "transcript": {
//     "speaker": "Participant Name",
//     "words": [{ "text": "hello", "start_time": 1.0, "end_time": 1.5 }],
//     "is_final": true
//   }
// }
// ---------------------------------------------------------------------------

router.post("/webhooks/recall/transcript", (req: Request, res: Response) => {
  const { bot_id, transcript } = req.body ?? {};

  if (!bot_id || !transcript) {
    res.status(400).json({ error: "Missing bot_id or transcript" });
    return;
  }

  // Build a single text string from the words array
  const words: Array<{ text: string }> = transcript.words ?? [];
  const text = words.map((w) => w.text).join(" ").trim();

  if (!text) {
    // Empty transcript segment — acknowledge but skip
    res.sendStatus(204);
    return;
  }

  const entry: TranscriptEntry = {
    speaker: transcript.speaker ?? "Unknown",
    text,
    timestamp: new Date(),
  };

  console.log(
    `[Webhook] Transcript from bot ${bot_id}: ${entry.speaker}: "${entry.text}"`
  );

  for (const cb of transcriptListeners) {
    try {
      cb(bot_id, entry);
    } catch (err) {
      console.error("[Webhook] Transcript listener error:", err);
    }
  }

  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// POST /webhooks/recall/status
// Receives bot status changes from Recall.ai.
//
// Expected payload shape:
// {
//   "bot_id": "...",
//   "status": {
//     "code": "in_call_recording",
//     "message": "Bot is now recording"
//   }
// }
// ---------------------------------------------------------------------------

router.post("/webhooks/recall/status", (req: Request, res: Response) => {
  const { bot_id, status } = req.body ?? {};

  if (!bot_id || !status) {
    res.status(400).json({ error: "Missing bot_id or status" });
    return;
  }

  const mapped = mapRecallStatus(status.code ?? "");

  console.log(
    `[Webhook] Status change for bot ${bot_id}: ${status.code} → ${mapped}`
  );

  for (const cb of statusListeners) {
    try {
      cb(bot_id, mapped);
    } catch (err) {
      console.error("[Webhook] Status listener error:", err);
    }
  }

  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// POST /webhooks/recall/audio
// Receives audio data if using audio-based processing.
//
// The request body is raw audio bytes with Content-Type: audio/raw
// The bot_id is passed as a query parameter.
// ---------------------------------------------------------------------------

router.post("/webhooks/recall/audio", (req: Request, res: Response) => {
  const botId = req.query.bot_id as string;

  if (!botId) {
    res.status(400).json({ error: "Missing bot_id query parameter" });
    return;
  }

  // Body should be raw audio buffer
  const audioData = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(req.body ?? "");

  if (audioData.length === 0) {
    res.sendStatus(204);
    return;
  }

  console.log(
    `[Webhook] Audio data for bot ${botId}: ${audioData.length} bytes`
  );

  for (const cb of audioListeners) {
    try {
      cb(botId, audioData);
    } catch (err) {
      console.error("[Webhook] Audio listener error:", err);
    }
  }

  res.sendStatus(204);
});

export default router;

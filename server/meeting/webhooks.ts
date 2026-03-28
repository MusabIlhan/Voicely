import { Router, type Request, type Response } from "express";
import { voiceCoordinator } from "../voice/voiceCoordinator.js";
import type { MeetingBotStatus, TranscriptEntry } from "./types.js";

const router = Router();

type RecallLifecycle = "joining" | "in_call" | "done" | "error";

function mapRecallStatus(code: string): RecallLifecycle {
  const mapping: Record<string, RecallLifecycle> = {
    ready: "joining",
    joining_call: "joining",
    in_waiting_room: "joining",
    in_call_not_recording: "in_call",
    in_call_recording: "in_call",
    call_ended: "done",
    done: "done",
    analysis_done: "done",
    fatal: "error",
  };

  return mapping[code] ?? "error";
}

router.post("/webhooks/recall/transcript", async (req: Request, res: Response) => {
  const { bot_id, transcript } = req.body ?? {};
  if (!bot_id || !transcript) {
    res.status(400).json({ error: "Missing bot_id or transcript" });
    return;
  }

  const words: Array<{ text?: string }> = transcript.words ?? [];
  const text = words
    .map((word) => (typeof word.text === "string" ? word.text : ""))
    .join(" ")
    .trim();

  if (!text) {
    res.sendStatus(204);
    return;
  }

  await voiceCoordinator.handleMeetingTranscript(
    String(bot_id),
    typeof transcript.speaker === "string" ? transcript.speaker : "Unknown",
    text
  );

  res.sendStatus(204);
});

router.post("/webhooks/recall/status", async (req: Request, res: Response) => {
  const { bot_id, status } = req.body ?? {};
  if (!bot_id || !status) {
    res.status(400).json({ error: "Missing bot_id or status" });
    return;
  }

  await voiceCoordinator.handleMeetingLifecycle(String(bot_id), mapRecallStatus(String(status.code ?? "")));
  res.sendStatus(204);
});

router.post("/webhooks/recall/audio", (_req: Request, res: Response) => {
  res.sendStatus(204);
});

export function clearListeners(): void {
  // Legacy no-op kept for test compatibility.
}

export function onTranscript(_callback: (botId: string, entry: TranscriptEntry) => void): void {
  void _callback;
  // Legacy no-op kept for test compatibility.
}

export function onStatusChange(_callback: (botId: string, status: MeetingBotStatus) => void): void {
  void _callback;
  // Legacy no-op kept for test compatibility.
}

export function onAudio(_callback: (botId: string, audioData: Buffer) => void): void {
  void _callback;
  // Legacy no-op kept for test compatibility.
}

export default router;

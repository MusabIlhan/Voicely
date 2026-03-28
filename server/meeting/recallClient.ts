import { config } from "../config.js";
import type { RecallBotConfig, RecallBotResponse } from "./types.js";

// ---------------------------------------------------------------------------
// Recall.ai REST API client
// ---------------------------------------------------------------------------

function apiUrl(path: string): string {
  const base = config.recall.apiBaseUrl.replace(/\/+$/, "");
  return `${base}${path}`;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Token ${config.recall.apiKey}`,
    "Content-Type": "application/json",
  };
}

async function recallFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string>) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Recall.ai API error ${res.status} ${res.statusText}: ${body}`
    );
  }

  // 204 No Content — return empty object
  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Bot lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a Recall.ai bot and send it to join a meeting.
 */
export async function createBot(
  meetingUrl: string,
  botName?: string
): Promise<RecallBotResponse> {
  const webhookBase = config.server.publicUrl.replace(/\/+$/, "");

  const body: RecallBotConfig = {
    meeting_url: meetingUrl,
    bot_name: botName ?? "Voisli Assistant",
    real_time_transcription: {
      destination_url: `${webhookBase}/webhooks/recall/transcript`,
    },
    transcription_options: {
      provider: "meeting_captions",
    },
    recording_mode: "audio_only",
    chat: {
      on_bot_join: {
        send_to: "everyone",
        message:
          "Hi! I'm Voisli, an AI meeting assistant. Mention my name if you have a question.",
      },
    },
  };

  return recallFetch<RecallBotResponse>("/bot/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Remove a bot from a meeting (makes it leave).
 */
export async function removeBot(botId: string): Promise<void> {
  await recallFetch<void>(`/bot/${botId}/leave_call/`, {
    method: "POST",
  });
}

/**
 * Get the current status of a bot.
 */
export async function getBotStatus(
  botId: string
): Promise<RecallBotResponse> {
  return recallFetch<RecallBotResponse>(`/bot/${botId}/`);
}

/**
 * Send audio data to the meeting so the bot speaks out loud.
 * Uses Recall.ai's real-time output API.
 */
export async function sendAudioToMeeting(
  botId: string,
  audioData: Buffer
): Promise<void> {
  const url = apiUrl(`/bot/${botId}/output_audio/`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.recall.apiKey}`,
      "Content-Type": "audio/raw",
    },
    body: new Uint8Array(audioData),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Recall.ai output audio error ${res.status} ${res.statusText}: ${body}`
    );
  }
}

/**
 * List all currently active bots.
 */
export async function listActiveBots(): Promise<RecallBotResponse[]> {
  const data = await recallFetch<{ results: RecallBotResponse[] }>("/bot/");
  return data.results;
}

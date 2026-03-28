import { config } from "../config.js";
import { encodePcmToMp3Base64 } from "../audio/mp3.js";
import type { RecallBotConfig, RecallBotResponse } from "./types.js";
import { outputMediaHub } from "./outputMediaHub.js";

const REALTIME_AUDIO_WEBSOCKET_PATH = "/webhooks/recall/realtime";
const OUTPUT_MEDIA_PATH_PREFIX = "/output-media";
const SILENT_AUDIO_SAMPLE_RATE = 24000;

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
  options: RequestInit = {},
): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string>) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Recall.ai API error ${res.status} ${res.statusText}: ${body}`,
    );
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

function getRealtimeWebsocketUrl(): string {
  const base = config.server.publicUrl.replace(/^https:\/\//, "wss://");
  return `${base.replace(/\/+$/, "")}${REALTIME_AUDIO_WEBSOCKET_PATH}`;
}

function getOutputMediaPageUrl(sessionToken: string): string {
  const base = config.server.publicUrl.replace(/\/+$/, "");
  return `${base}${OUTPUT_MEDIA_PATH_PREFIX}/${encodeURIComponent(sessionToken)}`;
}

export async function createBot(
  meetingUrl: string,
  botName?: string,
): Promise<RecallBotResponse> {
  const requestedBotName = botName ?? "Voisli Assistant";
  const outputMediaToken = outputMediaHub.createSessionToken();
  const body: RecallBotConfig = {
    meeting_url: meetingUrl,
    bot_name: requestedBotName,
    recording_config: {
      audio_mixed_raw: {},
      include_bot_in_recording: {
        audio: true,
      },
      realtime_endpoints: [
        {
          type: "websocket",
          url: getRealtimeWebsocketUrl(),
          events: [
            "audio_mixed_raw.data",
            "participant_events.speech_on",
            "participant_events.speech_off",
          ],
        },
      ],
    },
    output_media: {
      camera: {
        kind: "webpage",
        config: {
          url: getOutputMediaPageUrl(outputMediaToken),
        },
      },
    },
    chat: {
      on_bot_join: {
        send_to: "everyone",
        message:
          "Hi! I'm Voisli, an AI meeting assistant. Say 'Hey Assistant' or 'Hey Yapper' if you want me to help.",
      },
    },
  };

  const createdBot = await recallFetch<RecallBotResponse>("/bot/", {
    method: "POST",
    body: JSON.stringify(body),
  });

  outputMediaHub.registerSessionToken(outputMediaToken, createdBot.id);

  return createdBot;
}

export async function removeBot(botId: string): Promise<void> {
  await recallFetch<void>(`/bot/${botId}/leave_call/`, {
    method: "POST",
  });
}

export async function getBotStatus(botId: string): Promise<RecallBotResponse> {
  return recallFetch<RecallBotResponse>(`/bot/${botId}/`);
}

export async function sendAudioToMeeting(
  botId: string,
  audioData: Buffer,
  sampleRate = SILENT_AUDIO_SAMPLE_RATE,
): Promise<void> {
  const b64_data = encodePcmToMp3Base64(audioData, sampleRate);

  const res = await fetch(apiUrl(`/bot/${botId}/output_audio/`), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      kind: "mp3",
      b64_data,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Recall.ai output audio error ${res.status} ${res.statusText}: ${body}`,
    );
  }
}

export async function listActiveBots(): Promise<RecallBotResponse[]> {
  const data = await recallFetch<{ results: RecallBotResponse[] }>("/bot/");
  return data.results;
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    recall: {
      apiKey: "test_recall_key",
      apiBaseUrl: "https://eu-central-1.recall.ai/api/v1",
    },
    server: {
      publicUrl: "https://test.ngrok.io",
    },
  },
}));

import {
  createBot,
  removeBot,
  getBotStatus,
  sendAudioToMeeting,
  listActiveBots,
} from "../recallClient";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

describe("createBot", () => {
  it("creates the bot with output media configured in the initial EU realtime audio payload", async () => {
    const botResponse = {
      id: "bot_123",
      status_changes: [],
      meeting_url: "https://meet.google.com/abc-defg-hij",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(botResponse));

    const result = await createBot("https://meet.google.com/abc-defg-hij");

    const [createUrl, createOpts] = mockFetch.mock.calls[0];
    expect(createUrl).toBe("https://eu-central-1.recall.ai/api/v1/bot/");
    expect(createOpts.method).toBe("POST");
    expect(createOpts.headers.Authorization).toBe("Token test_recall_key");
    expect(createOpts.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(createOpts.body);
    expect(body.meeting_url).toBe("https://meet.google.com/abc-defg-hij");
    expect(body.bot_name).toBe("Voisli Assistant");
    expect(body.recording_config.audio_mixed_raw).toEqual({});
    expect(body.recording_config.include_bot_in_recording).toEqual({
      audio: true,
    });
    expect(body.recording_config.realtime_endpoints).toEqual([
      {
        type: "websocket",
        url: "wss://test.ngrok.io/webhooks/recall/realtime",
        events: [
          "audio_mixed_raw.data",
          "participant_events.speech_on",
          "participant_events.speech_off",
        ],
      },
    ]);
    expect(body.output_media.camera.kind).toBe("webpage");
    expect(body.output_media.camera.config.url).toMatch(
      /^https:\/\/test\.ngrok\.io\/output-media\/.+$/,
    );
    expect(body.real_time_transcription).toBeUndefined();
    expect(body.transcription_options).toBeUndefined();
    expect(body.recording_mode).toBeUndefined();

    expect(result).toEqual(botResponse);
  });

  it("uses a custom bot name when provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "bot_456" }));
    await createBot("https://meet.google.com/test", "Custom Bot");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.bot_name).toBe("Custom Bot");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));
    await expect(createBot("https://meet.google.com/test")).rejects.toThrow(
      /Recall\.ai API error 401/,
    );
  });
});

describe("removeBot", () => {
  it("sends a POST to /bot/:id/leave_call/", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    } as unknown as Response);

    await removeBot("bot_123");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://eu-central-1.recall.ai/api/v1/bot/bot_123/leave_call/");
    expect(opts.method).toBe("POST");
  });
});

describe("getBotStatus", () => {
  it("sends a GET to /bot/:id/", async () => {
    const botData = {
      id: "bot_123",
      status_changes: [],
      meeting_url: "https://meet.google.com/abc",
    };
    mockFetch.mockResolvedValue(jsonResponse(botData));

    const result = await getBotStatus("bot_123");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://eu-central-1.recall.ai/api/v1/bot/bot_123/");
    expect(opts.method).toBeUndefined();
    expect(result).toEqual(botData);
  });
});

describe("sendAudioToMeeting", () => {
  it("sends mp3 audio json to the output_audio endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(""),
    } as unknown as Response);

    const audio = Buffer.alloc(24000);
    await sendAudioToMeeting("bot_123", audio, 24000);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://eu-central-1.recall.ai/api/v1/bot/bot_123/output_audio/");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(opts.body);
    expect(body.kind).toBe("mp3");
    expect(typeof body.b64_data).toBe("string");
    expect(body.b64_data.length).toBeGreaterThan(0);
  });

  it("throws on API error for audio output", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: () => Promise.resolve("Invalid audio format"),
    } as unknown as Response);

    await expect(
      sendAudioToMeeting("bot_123", Buffer.alloc(24000), 24000),
    ).rejects.toThrow(/Recall\.ai output audio error 400/);
  });
});

describe("listActiveBots", () => {
  it("returns results array from paginated response", async () => {
    const bots = [
      { id: "bot_1", status_changes: [], meeting_url: "https://meet.google.com/a" },
      { id: "bot_2", status_changes: [], meeting_url: "https://meet.google.com/b" },
    ];
    mockFetch.mockResolvedValue(jsonResponse({ results: bots }));

    const result = await listActiveBots();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://eu-central-1.recall.ai/api/v1/bot/");
    expect(result).toEqual(bots);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    recall: {
      apiKey: "test_recall_key",
      apiBaseUrl: "https://us-west-2.recall.ai/api/v1",
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
  it("sends a POST request to /bot/ with correct payload", async () => {
    const botResponse = {
      id: "bot_123",
      status_changes: [{ code: "ready", message: "Bot created", created_at: "2026-03-28T00:00:00Z" }],
      meeting_url: "https://meet.google.com/abc-defg-hij",
    };
    mockFetch.mockResolvedValue(jsonResponse(botResponse));

    const result = await createBot("https://meet.google.com/abc-defg-hij");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://us-west-2.recall.ai/api/v1/bot/");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Token test_recall_key");
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body);
    expect(body.meeting_url).toBe("https://meet.google.com/abc-defg-hij");
    expect(body.bot_name).toBe("Voisli Assistant");
    expect(body.real_time_transcription.destination_url).toBe(
      "https://test.ngrok.io/webhooks/recall/transcript"
    );
    expect(body.transcription_options.provider).toBe("meeting_captions");
    expect(body.recording_mode).toBe("audio_only");

    expect(result).toEqual(botResponse);
  });

  it("uses a custom bot name when provided", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "bot_456" }));

    await createBot("https://meet.google.com/test", "Custom Bot");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.bot_name).toBe("Custom Bot");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));

    await expect(createBot("https://meet.google.com/test")).rejects.toThrow(
      /Recall\.ai API error 401/
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
    expect(url).toBe("https://us-west-2.recall.ai/api/v1/bot/bot_123/leave_call/");
    expect(opts.method).toBe("POST");
  });
});

describe("getBotStatus", () => {
  it("sends a GET to /bot/:id/", async () => {
    const botData = {
      id: "bot_123",
      status_changes: [{ code: "in_call_recording", message: "Recording", created_at: "2026-03-28T00:01:00Z" }],
      meeting_url: "https://meet.google.com/abc",
    };
    mockFetch.mockResolvedValue(jsonResponse(botData));

    const result = await getBotStatus("bot_123");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://us-west-2.recall.ai/api/v1/bot/bot_123/");
    expect(opts.method).toBeUndefined(); // GET is default
    expect(result).toEqual(botData);
  });
});

describe("sendAudioToMeeting", () => {
  it("sends raw audio data with correct content type", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(""),
    } as unknown as Response);

    const audio = Buffer.from([0x01, 0x02, 0x03]);
    await sendAudioToMeeting("bot_123", audio);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://us-west-2.recall.ai/api/v1/bot/bot_123/output_audio/");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("audio/raw");
    expect(new Uint8Array(opts.body)).toEqual(new Uint8Array(audio));
  });

  it("throws on API error for audio output", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: () => Promise.resolve("Invalid audio format"),
    } as unknown as Response);

    await expect(
      sendAudioToMeeting("bot_123", Buffer.from([]))
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
    expect(url).toBe("https://us-west-2.recall.ai/api/v1/bot/");
    expect(result).toEqual(bots);
    expect(result).toHaveLength(2);
  });
});

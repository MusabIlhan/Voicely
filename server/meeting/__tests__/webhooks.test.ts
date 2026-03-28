import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { handleMeetingTranscript, handleMeetingLifecycle } = vi.hoisted(() => ({
  handleMeetingTranscript: vi.fn(),
  handleMeetingLifecycle: vi.fn(),
}));

vi.mock("../../voice/voiceCoordinator.js", () => ({
  voiceCoordinator: {
    handleMeetingTranscript,
    handleMeetingLifecycle,
  },
}));

import router from "../webhooks";

async function dispatch(
  method: string,
  url: string,
  body?: Record<string, unknown>
): Promise<{ statusCode: number }> {
  return await new Promise((resolve, reject) => {
    const req = Object.assign(new EventEmitter(), {
      method,
      url,
      originalUrl: url,
      body: body ?? {},
      headers: {},
    });

    let statusCode = 200;
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;
      resolve({ statusCode });
    };

    const res = {
      status: vi.fn((code: number) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn(() => {
        finish();
        return res;
      }),
      sendStatus: vi.fn((code: number) => {
        statusCode = code;
        finish();
        return res;
      }),
    };

    (router as unknown as { handle: Function }).handle(req as never, res as never, (error?: unknown) => {
      if (error) {
        reject(error);
        return;
      }

      finish();
    });
  });
}

describe("Recall webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards transcript updates to the shared voice coordinator", async () => {
    const response = await dispatch("POST", "/webhooks/recall/transcript", {
      bot_id: "bot-1",
      transcript: {
        speaker: "Alice",
        words: [{ text: "hello" }, { text: "there" }],
      },
    });

    expect(response.statusCode).toBe(204);
    expect(handleMeetingTranscript).toHaveBeenCalledWith("bot-1", "Alice", "hello there");
  });

  it("maps Recall terminal statuses and allows duplicate terminal delivery", async () => {
    const first = await dispatch("POST", "/webhooks/recall/status", {
      bot_id: "bot-1",
      status: { code: "call_ended" },
    });
    const second = await dispatch("POST", "/webhooks/recall/status", {
      bot_id: "bot-1",
      status: { code: "fatal" },
    });

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
    expect(handleMeetingLifecycle).toHaveBeenNthCalledWith(1, "bot-1", "done");
    expect(handleMeetingLifecycle).toHaveBeenNthCalledWith(2, "bot-1", "error");
  });
});

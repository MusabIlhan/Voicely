import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { handleTwilioTerminalEvent, updateTwilioCallReference } = vi.hoisted(() => ({
  handleTwilioTerminalEvent: vi.fn().mockResolvedValue(undefined),
  updateTwilioCallReference: vi.fn(),
}));

vi.mock("../voice/voiceCoordinator.js", () => ({
  voiceCoordinator: {
    handleTwilioTerminalEvent,
    updateTwilioCallReference,
  },
}));

import router from "./webhooks";

async function dispatch(
  method: string,
  url: string,
  body?: Record<string, unknown>
): Promise<{ statusCode: number; text: string }> {
  return await new Promise((resolve, reject) => {
    const req = Object.assign(new EventEmitter(), {
      method,
      url,
      originalUrl: url,
      body: body ?? {},
      headers: {},
    });

    let statusCode = 200;
    let text = "";
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;
      resolve({ statusCode, text });
    };

    const res = {
      type: vi.fn(() => res),
      status: vi.fn((code: number) => {
        statusCode = code;
        return res;
      }),
      send: vi.fn((payload?: string) => {
        if (payload) {
          text = payload;
        }
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

describe("Twilio webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders session-specific TwiML media stream URLs", async () => {
    const response = await dispatch("POST", "/twiml/session-123");

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain("/media-stream/session-123");
  });

  it("treats completed status callbacks as terminal events", async () => {
    const response = await dispatch("POST", "/call-status/session-123", {
      CallSid: "CA123",
      CallStatus: "completed",
    });

    expect(response.statusCode).toBe(204);
    expect(handleTwilioTerminalEvent).toHaveBeenCalledWith("session-123", "twilio_completed_callback");
  });
});

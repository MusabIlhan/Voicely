import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingBotStatus } from "../types";

type StatusCb = (botId: string, status: MeetingBotStatus) => void;

const { mockCreateBot, mockRemoveBot, mockSendAudio, statusCallbacks, geminiInstances } =
  vi.hoisted(() => ({
    mockCreateBot: vi.fn(),
    mockRemoveBot: vi.fn(),
    mockSendAudio: vi.fn(),
    statusCallbacks: [] as StatusCb[],
    geminiInstances: [] as Array<{
      connect: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      sendAudio: ReturnType<typeof vi.fn>;
      sendToolResponse: ReturnType<typeof vi.fn>;
      emit: (event: string, ...args: unknown[]) => boolean;
      on: (event: string, listener: (...args: unknown[]) => void) => unknown;
      onAudio: (callback: (audio: Buffer) => void) => void;
    }>,
  }));

vi.mock("../webhooks.js", () => ({
  onStatusChange: vi.fn((cb: StatusCb) => {
    statusCallbacks.push(cb);
  }),
}));

vi.mock("../recallClient.js", () => ({
  createBot: (...args: unknown[]) => mockCreateBot(...args),
  removeBot: (...args: unknown[]) => mockRemoveBot(...args),
  sendAudioToMeeting: (...args: unknown[]) => mockSendAudio(...args),
}));

vi.mock("../../gemini/liveClient.js", () => ({
  GeminiLiveSession: class {
    private emitter = new (require("events").EventEmitter)();
    connect = vi.fn(async () => {
      this.emitter.emit("connected");
    });
    close = vi.fn(() => {
      this.emitter.emit("disconnected");
    });
    sendAudio = vi.fn();
    sendToolResponse = vi.fn();
    constructor(...args: unknown[]) {
      void args;
      geminiInstances.push(this as never);
    }
    emit(event: string, ...args: unknown[]) {
      return this.emitter.emit(event, ...args);
    }
    on(event: string, listener: (...args: unknown[]) => void) {
      this.emitter.on(event, listener);
      return this;
    }
    onAudio(callback: (audio: Buffer) => void): void {
      this.emitter.on("audio", callback);
    }
  },
}));

import {
  MeetingOrchestrator,
  findWakeMatch,
  normalizeWakeText,
} from "../meetingOrchestrator";

function botResponse(id = "bot_123") {
  return {
    id,
    status_changes: [],
    meeting_url: "https://meet.google.com/abc-defg-hij",
  };
}

describe("MeetingOrchestrator", () => {
  let orch: MeetingOrchestrator;
  let gemini: (typeof geminiInstances)[number];

  beforeEach(async () => {
    mockCreateBot.mockReset();
    mockRemoveBot.mockReset();
    mockSendAudio.mockReset();
    statusCallbacks.length = 0;
    geminiInstances.length = 0;

    mockCreateBot.mockResolvedValue(botResponse());
    mockRemoveBot.mockResolvedValue(undefined);
    mockSendAudio.mockResolvedValue(undefined);

    orch = new MeetingOrchestrator({ cooldownMs: 50 });
    await orch.joinMeeting("https://meet.google.com/abc");
    gemini = geminiInstances[0];
  });

  afterEach(() => {
    orch.removeAllListeners();
  });

  it("creates a session and connects Gemini Live when joining", () => {
    expect(mockCreateBot).toHaveBeenCalledWith(
      "https://meet.google.com/abc",
      undefined,
    );
    expect(gemini.connect).toHaveBeenCalled();
    expect(orch.getSession("bot_123")?.status).toBe("creating");
  });

  it("forwards realtime mixed audio into Gemini", () => {
    orch.handleRealtimeEvent({
      event: "audio_mixed_raw.data",
      data: {
        bot: { id: "bot_123" },
        data: {
          buffer: Buffer.from([0x01, 0x02, 0x03]).toString("base64"),
        },
      },
    });

    expect(gemini.sendAudio).toHaveBeenCalledWith(Buffer.from([0x01, 0x02, 0x03]));
  });

  it("does not speak back before wake word", async () => {
    gemini.emit("inputTranscription", "Let's ship next week");
    gemini.emit("outputTranscription", "I can help with that");
    gemini.emit("audio", Buffer.alloc(4800));
    gemini.emit("turnComplete");

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockSendAudio).not.toHaveBeenCalled();
  });

  it("responds when the wake word is heard", async () => {
    const responses: Array<{ question: string; answer: string }> = [];
    orch.on("response", (_botId, question, answer) => {
      responses.push({ question, answer });
    });

    gemini.emit("inputTranscription", "Hey Yapper, what's next?");
    gemini.emit("outputTranscription", "We should review the roadmap.");
    gemini.emit("audio", Buffer.alloc(4800));
    gemini.emit("turnComplete");

    await vi.waitFor(() => {
      expect(mockSendAudio).toHaveBeenCalledTimes(1);
    });

    expect(mockSendAudio).toHaveBeenCalledWith(
      "bot_123",
      expect.any(Buffer),
      24000,
    );
    expect(responses[0]).toEqual({
      question: "Hey Yapper, what's next?",
      answer: "We should review the roadmap.",
    });
  });

  it("matches phonetic wake phrase variants", () => {
    expect(normalizeWakeText("Hey, yapper!")).toBe("hey yapper");
    expect(findWakeMatch("Hey, yapper").matchedAlias).toBe("yapper");
    expect(findWakeMatch("ok yaper").matchedAlias).toBe("yaper");
    expect(findWakeMatch("yo yapr").matchedAlias).toBe("yapr");
    expect(findWakeMatch("Hey, yappa.").matchedAlias).toBe("yappa");
    expect(findWakeMatch("Hey assistant").matchedAlias).toBe("assistant");
    expect(findWakeMatch("voyage planning").matchedAlias).toBeNull();
  });

  it("responds when a phonetic wake phrase is heard", async () => {
    gemini.emit("inputTranscription", "Hey, yaper, can you hear me?");
    gemini.emit("outputTranscription", "Yes, I can hear you.");
    gemini.emit("audio", Buffer.alloc(4800));
    gemini.emit("turnComplete");

    await vi.waitFor(() => {
      expect(mockSendAudio).toHaveBeenCalledTimes(1);
    });

    expect(mockSendAudio).toHaveBeenCalledWith(
      "bot_123",
      expect.any(Buffer),
      24000,
    );
  });

  it("allows a follow-up turn during the wake window", async () => {
    gemini.emit("inputTranscription", "Hey Yapper, first question");
    gemini.emit("outputTranscription", "First answer");
    gemini.emit("audio", Buffer.alloc(4800));
    gemini.emit("turnComplete");

    await vi.waitFor(() => {
      expect(mockSendAudio).toHaveBeenCalledTimes(1);
    });

    await new Promise((resolve) => setTimeout(resolve, 900));

    gemini.emit("inputTranscription", "And what about tomorrow?");
    gemini.emit("outputTranscription", "Tomorrow looks clear.");
    gemini.emit("audio", Buffer.alloc(4800));
    gemini.emit("turnComplete");

    await vi.waitFor(() => {
      expect(mockSendAudio).toHaveBeenCalledTimes(2);
    });
  });

  it("suppresses tool calls when wake word was not detected", async () => {
    gemini.emit("toolCall", {
      functionCalls: [{ name: "search_business", args: { query: "pizza" } }],
    });

    await vi.waitFor(() => {
      expect(gemini.sendToolResponse).toHaveBeenCalledTimes(1);
    });

    expect(gemini.sendToolResponse.mock.calls[0][0][0]).toMatchObject({
      name: "search_business",
      response: { ignored: true },
    });
  });

  it("drops model output before wake", async () => {
    gemini.emit("outputTranscription", "I should stay silent.");
    gemini.emit("audio", Buffer.alloc(4800));
    gemini.emit("turnComplete");

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockSendAudio).not.toHaveBeenCalled();
  });

  it("updates session status from webhook callbacks", () => {
    statusCallbacks[0]("bot_123", "in_call");
    expect(orch.getSession("bot_123")?.status).toBe("in_call");
  });

  it("cleans up the Gemini session when leaving", async () => {
    await orch.leaveMeeting("bot_123");
    expect(mockRemoveBot).toHaveBeenCalledWith("bot_123");
    expect(gemini.close).toHaveBeenCalled();
    expect(orch.getSession("bot_123")?.status).toBe("done");
  });
});

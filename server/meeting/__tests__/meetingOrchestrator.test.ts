import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TranscriptEntry, MeetingBotStatus } from "../types";

// ---------------------------------------------------------------------------
// vi.hoisted — these must exist before vi.mock factories execute
// ---------------------------------------------------------------------------

type TranscriptCb = (botId: string, entry: TranscriptEntry) => void;
type StatusCb = (botId: string, status: MeetingBotStatus) => void;

const {
  mockCreateBot,
  mockRemoveBot,
  mockSendAudio,
  mockHandleQuestion,
  mockGenerateAudioResponse,
  capturedCbs,
} = vi.hoisted(() => ({
  mockCreateBot: vi.fn(),
  mockRemoveBot: vi.fn(),
  mockSendAudio: vi.fn(),
  mockHandleQuestion: vi.fn(),
  mockGenerateAudioResponse: vi.fn(),
  capturedCbs: {
    transcript: undefined as TranscriptCb | undefined,
    status: undefined as StatusCb | undefined,
  },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../webhooks.js", () => ({
  onTranscript: vi.fn((cb: TranscriptCb) => {
    capturedCbs.transcript = cb;
  }),
  onStatusChange: vi.fn((cb: StatusCb) => {
    capturedCbs.status = cb;
  }),
}));

vi.mock("../recallClient.js", () => ({
  createBot: (...args: unknown[]) => mockCreateBot(...args),
  removeBot: (...args: unknown[]) => mockRemoveBot(...args),
  sendAudioToMeeting: (...args: unknown[]) => mockSendAudio(...args),
}));

vi.mock("../meetingAI.js", () => ({
  MeetingAI: class MockMeetingAI {
    handleQuestion = mockHandleQuestion;
    generateAudioResponse = mockGenerateAudioResponse;
  },
}));

// Import the class AFTER mocks are set up
import { MeetingOrchestrator } from "../meetingOrchestrator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  speaker: string,
  text: string,
  timestamp?: Date
): TranscriptEntry {
  return { speaker, text, timestamp: timestamp ?? new Date() };
}

function defaultBotResponse(id = "bot_123") {
  return {
    id,
    status_changes: [],
    meeting_url: "https://meet.google.com/abc-defg-hij",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MeetingOrchestrator", () => {
  let orch: MeetingOrchestrator;

  beforeEach(() => {
    capturedCbs.transcript = undefined;
    capturedCbs.status = undefined;

    mockCreateBot.mockReset();
    mockRemoveBot.mockReset();
    mockSendAudio.mockReset();
    mockHandleQuestion.mockReset();
    mockGenerateAudioResponse.mockReset();

    // Default mocks
    mockCreateBot.mockResolvedValue(defaultBotResponse());
    mockRemoveBot.mockResolvedValue(undefined);
    mockSendAudio.mockResolvedValue(undefined);
    mockHandleQuestion.mockResolvedValue("Here is the answer.");
    mockGenerateAudioResponse.mockResolvedValue(Buffer.from([0x01, 0x02]));

    // Use a very short cooldown for fast tests
    orch = new MeetingOrchestrator({ cooldownMs: 50 });
  });

  afterEach(() => {
    orch.removeAllListeners();
  });

  // -------------------------------------------------------------------------
  // Meeting lifecycle: join → active → leave
  // -------------------------------------------------------------------------

  describe("meeting lifecycle", () => {
    it("creates a session when joining a meeting", async () => {
      const session = await orch.joinMeeting("https://meet.google.com/abc");

      expect(mockCreateBot).toHaveBeenCalledWith(
        "https://meet.google.com/abc",
        undefined
      );
      expect(session.botId).toBe("bot_123");
      expect(session.meetingUrl).toBe("https://meet.google.com/abc");
      expect(session.status).toBe("creating");
      expect(session.participants).toEqual([]);
    });

    it("passes custom bot name to createBot", async () => {
      await orch.joinMeeting("https://meet.google.com/abc", "My Bot");

      expect(mockCreateBot).toHaveBeenCalledWith(
        "https://meet.google.com/abc",
        "My Bot"
      );
    });

    it("tracks the session in getAllSessions", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      const sessions = orch.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].botId).toBe("bot_123");
    });

    it("retrieves a session by botId", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      const session = orch.getSession("bot_123");
      expect(session).toBeDefined();
      expect(session!.botId).toBe("bot_123");
    });

    it("returns undefined for unknown botId", () => {
      expect(orch.getSession("nonexistent")).toBeUndefined();
    });

    it("leaves a meeting and sets status to done", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      const endedPromise = new Promise<void>((resolve) => {
        orch.on("ended", () => resolve());
      });

      await orch.leaveMeeting("bot_123");
      await endedPromise;

      expect(mockRemoveBot).toHaveBeenCalledWith("bot_123");
      const session = orch.getSession("bot_123");
      expect(session!.status).toBe("done");
      expect(session!.endedAt).toBeInstanceOf(Date);
    });

    it("throws when leaving a nonexistent session", async () => {
      await expect(orch.leaveMeeting("nope")).rejects.toThrow(
        /No session found/
      );
    });

    it("handles removeBot errors gracefully during leave", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");
      mockRemoveBot.mockRejectedValue(new Error("Already left"));

      // Should not throw
      await orch.leaveMeeting("bot_123");

      const session = orch.getSession("bot_123");
      expect(session!.status).toBe("done");
    });

    it("emits statusChange when status updates via webhook", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      const statusEvents: string[] = [];
      orch.on("statusChange", (session) => statusEvents.push(session.status));

      capturedCbs.status!("bot_123", "in_call");

      expect(statusEvents).toEqual(["in_call"]);
      expect(orch.getSession("bot_123")!.status).toBe("in_call");
    });

    it("sets endedAt and emits 'ended' on done status via webhook", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      const endedSessions: string[] = [];
      orch.on("ended", (session) => endedSessions.push(session.botId));

      capturedCbs.status!("bot_123", "done");

      expect(endedSessions).toEqual(["bot_123"]);
      expect(orch.getSession("bot_123")!.endedAt).toBeInstanceOf(Date);
    });

    it("cleans up on error status via webhook", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      const endedSessions: string[] = [];
      orch.on("ended", (session) => endedSessions.push(session.botId));

      capturedCbs.status!("bot_123", "error");

      expect(endedSessions).toEqual(["bot_123"]);
      expect(orch.getSession("bot_123")!.status).toBe("error");
    });

    it("ignores status change for unknown bot", () => {
      // Should not throw
      capturedCbs.status!("unknown_bot", "in_call");
    });
  });

  // -------------------------------------------------------------------------
  // Transcript handling and context
  // -------------------------------------------------------------------------

  describe("transcript handling", () => {
    it("adds transcript entries to the context manager", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      capturedCbs.transcript!("bot_123", makeEntry("Alice", "Hello everyone"));
      capturedCbs.transcript!("bot_123", makeEntry("Bob", "Hi Alice"));

      const transcript = orch.getTranscript("bot_123");
      expect(transcript).toHaveLength(2);
      expect(transcript[0].speaker).toBe("Alice");
      expect(transcript[1].speaker).toBe("Bob");
    });

    it("updates session participants from transcript", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      capturedCbs.transcript!("bot_123", makeEntry("Alice", "Hello"));
      capturedCbs.transcript!("bot_123", makeEntry("Bob", "Hi"));

      const session = orch.getSession("bot_123");
      expect(session!.participants).toHaveLength(2);
      expect(session!.participants.map((p) => p.name).sort()).toEqual([
        "Alice",
        "Bob",
      ]);
    });

    it("returns empty transcript for unknown bot", () => {
      expect(orch.getTranscript("nonexistent")).toEqual([]);
    });

    it("returns summary for a session", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Alice", "Hello everyone")
      );

      const summary = orch.getSummary("bot_123");
      expect(summary).toContain("Alice");
    });

    it("returns fallback summary for unknown bot", () => {
      expect(orch.getSummary("nonexistent")).toBe("No session found.");
    });

    it("ignores transcript for unknown bot", () => {
      // Should not throw
      capturedCbs.transcript!("unknown_bot", makeEntry("Alice", "Hello"));
    });
  });

  // -------------------------------------------------------------------------
  // Question detection → AI response → audio output pipeline
  // -------------------------------------------------------------------------

  describe("bot mention → AI response pipeline", () => {
    it("responds when bot is mentioned by name", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      const responseEvents: Array<{
        botId: string;
        question: string;
        answer: string;
      }> = [];
      orch.on("response", (botId, question, answer) =>
        responseEvents.push({ botId, question, answer })
      );

      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Alice", "Hey Voisli, when is our next standup?")
      );

      // Wait for async response pipeline
      await vi.waitFor(() => {
        expect(responseEvents).toHaveLength(1);
      });

      expect(mockHandleQuestion).toHaveBeenCalledWith(
        "Hey Voisli, when is our next standup?",
        expect.stringContaining("Alice")
      );
      expect(mockGenerateAudioResponse).toHaveBeenCalledWith(
        "Here is the answer."
      );
      expect(mockSendAudio).toHaveBeenCalledWith(
        "bot_123",
        expect.any(Buffer)
      );
      expect(responseEvents[0]).toEqual({
        botId: "bot_123",
        question: "Hey Voisli, when is our next standup?",
        answer: "Here is the answer.",
      });
    });

    it("does not respond to normal conversation", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Alice", "I think we should ship next week")
      );

      // Give time for async handler (if it were called)
      await new Promise((r) => setTimeout(r, 100));

      expect(mockHandleQuestion).not.toHaveBeenCalled();
    });

    it("skips sending audio when buffer is empty", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");
      mockGenerateAudioResponse.mockResolvedValue(Buffer.alloc(0));

      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Alice", "Hey Voisli, what time is it?")
      );

      await vi.waitFor(() => {
        expect(mockHandleQuestion).toHaveBeenCalled();
      });

      // Wait a tick for sendAudio check
      await new Promise((r) => setTimeout(r, 10));

      expect(mockSendAudio).not.toHaveBeenCalled();
    });

    it("emits error when AI pipeline fails", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");
      mockHandleQuestion.mockRejectedValue(new Error("AI broke"));

      const errors: Array<{ botId: string; message: string }> = [];
      orch.on("error", (botId, err) =>
        errors.push({ botId, message: err.message })
      );

      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Alice", "Hey Voisli, help me")
      );

      await vi.waitFor(() => {
        expect(errors).toHaveLength(1);
      });

      expect(errors[0]).toEqual({ botId: "bot_123", message: "AI broke" });
    });
  });

  // -------------------------------------------------------------------------
  // Cooldown logic
  // -------------------------------------------------------------------------

  describe("cooldown logic", () => {
    it("skips response when cooldown is active", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      // First mention — should respond
      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Alice", "Hey Voisli, first question?")
      );

      await vi.waitFor(() => {
        expect(mockHandleQuestion).toHaveBeenCalledTimes(1);
      });

      // Second mention immediately — should be skipped (cooldown = 50ms)
      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Bob", "Hey Voisli, second question?")
      );

      // Give it a moment, but it should NOT trigger another response
      await new Promise((r) => setTimeout(r, 30));

      expect(mockHandleQuestion).toHaveBeenCalledTimes(1);
    });

    it("responds again after cooldown expires", async () => {
      orch = new MeetingOrchestrator({ cooldownMs: 50 });
      await orch.joinMeeting("https://meet.google.com/abc");

      // First mention
      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Alice", "Hey Voisli, first?")
      );

      await vi.waitFor(() => {
        expect(mockHandleQuestion).toHaveBeenCalledTimes(1);
      });

      // Wait for cooldown to expire
      await new Promise((r) => setTimeout(r, 80));

      // Second mention — should respond
      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Bob", "Hey Voisli, second?")
      );

      await vi.waitFor(() => {
        expect(mockHandleQuestion).toHaveBeenCalledTimes(2);
      });
    });

    it("prevents concurrent responses for the same session", async () => {
      await orch.joinMeeting("https://meet.google.com/abc");

      // Make handleQuestion slow
      let resolveFirst!: () => void;
      const firstPromise = new Promise<string>((resolve) => {
        resolveFirst = () => resolve("Answer 1");
      });
      mockHandleQuestion.mockReturnValueOnce(firstPromise);

      // First mention — starts responding
      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Alice", "Hey Voisli, question 1?")
      );

      // Give the async handler a tick to start
      await new Promise((r) => setTimeout(r, 10));

      // Second mention while first is still processing — should be skipped
      capturedCbs.transcript!(
        "bot_123",
        makeEntry("Bob", "Hey Voisli, question 2?")
      );

      // Resolve the first response
      resolveFirst();

      await vi.waitFor(() => {
        expect(mockGenerateAudioResponse).toHaveBeenCalledTimes(1);
      });

      // Only the first question was handled
      expect(mockHandleQuestion).toHaveBeenCalledTimes(1);
    });
  });
});

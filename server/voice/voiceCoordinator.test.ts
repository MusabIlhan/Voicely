import { EventEmitter } from "events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceCoordinator } from "./voiceCoordinator.js";
import { VoiceSessionStore } from "./sessionStore.js";

class FakeTwilioTransport extends EventEmitter {
  sentAudio: string[] = [];

  sendAudio(audio: string): void {
    this.sentAudio.push(audio);
  }

  close(): void {
    this.emit("close");
  }
}

function createCoordinator() {
  const requestAssist = vi.fn();
  const sendSessionEnd = vi.fn().mockResolvedValue(true);
  const synthesize = vi.fn().mockResolvedValue(Buffer.from([0x01, 0x02]));
  const createMeetingBot = vi.fn().mockResolvedValue({ id: "bot-1" });
  const leaveMeetingBot = vi.fn().mockResolvedValue(undefined);
  const sendMeetingAudio = vi.fn().mockResolvedValue(undefined);
  const createSpeechTranscriber = vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    sendAudio: vi.fn(),
    close: vi.fn(),
    onFinalTranscript: vi.fn(),
    onError: vi.fn(),
  }));

  const coordinator = new VoiceCoordinator({
    agentClient: { requestAssist, sendSessionEnd },
    speechSynthesizer: { synthesize },
    store: new VoiceSessionStore(),
    createMeetingBot,
    leaveMeetingBot,
    sendMeetingAudio,
    createSpeechTranscriber,
  });

  return {
    coordinator,
    requestAssist,
    sendSessionEnd,
    synthesize,
    createMeetingBot,
    leaveMeetingBot,
    sendMeetingAudio,
    createSpeechTranscriber,
  };
}

describe("VoiceCoordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps session state isolated", async () => {
    const { coordinator, requestAssist } = createCoordinator();
    requestAssist.mockImplementation(async (payload: { turn_id: string }) => ({
      turn_id: payload.turn_id,
      say: "done",
      should_end_session: false,
    }));

    coordinator.createPhoneSession("session-a", "+15550000001");
    coordinator.createPhoneSession("session-b", "+15550000002");

    await coordinator.handleHumanTurn("session-a", "caller-a", "Hello from A.");
    await coordinator.handleHumanTurn("session-b", "caller-b", "Hello from B.");

    const sessionA = coordinator.getSession("session-a");
    const sessionB = coordinator.getSession("session-b");

    expect(sessionA?.transcript.map((turn) => turn.text)).toEqual(["Hello from A.", "done"]);
    expect(sessionB?.transcript.map((turn) => turn.text)).toEqual(["Hello from B.", "done"]);
  });

  it("sends only the last N structured turns to /assist", async () => {
    const { coordinator, requestAssist } = createCoordinator();
    requestAssist.mockImplementation(async (payload: { turn_id: string }) => ({
      turn_id: payload.turn_id,
      say: "ok",
      should_end_session: false,
    }));
    coordinator.createPhoneSession("session-1", "+15550000001");

    for (let index = 0; index < 10; index += 1) {
      await coordinator.handleHumanTurn("session-1", "caller", `turn-${index}.`);
    }

    const lastPayload = requestAssist.mock.calls.at(-1)?.[0];
    expect(lastPayload.recent_turns).toHaveLength(8);
    expect(lastPayload.recent_turns[0].text).not.toBe("turn-0.");
    expect(lastPayload.turn_id).toBe(lastPayload.recent_turns.at(-1)?.turn_id);
  });

  it("archives sessions after /session-end succeeds and ignores duplicate terminal triggers", async () => {
    const { coordinator, sendSessionEnd } = createCoordinator();
    coordinator.createPhoneSession("session-1", "+15550000001");

    await coordinator.handleTwilioTerminalEvent("session-1", "twilio_stream_closed");
    await coordinator.handleTwilioTerminalEvent("session-1", "twilio_completed_callback");

    expect(sendSessionEnd).toHaveBeenCalledTimes(1);
    expect(coordinator.getSession("session-1")).toBeUndefined();
    expect(coordinator.getSessionSnapshot("session-1")).toMatchObject({
      sessionId: "session-1",
      status: "ended",
      endedReason: "twilio_stream_closed",
    });
  });

  it("falls back when /assist returns malformed data", async () => {
    const { coordinator, requestAssist, synthesize } = createCoordinator();
    requestAssist.mockRejectedValue(new Error("Malformed /assist response: say must be a non-empty string"));
    const transport = new FakeTwilioTransport();

    coordinator.createPhoneSession("session-1", "+15550000001");
    coordinator.attachTwilioTransport("session-1", transport as never);

    await coordinator.handleHumanTurn("session-1", "caller", "Hello?");

    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(transport.sentAudio).toHaveLength(2);
    expect(coordinator.getSession("session-1")?.transcript.at(-1)?.text).toBe(
      "Sorry, I had trouble with that. Please try again."
    );
  });

  it("suppresses stale assist responses", async () => {
    const { coordinator, requestAssist } = createCoordinator();
    const transport = new FakeTwilioTransport();
    coordinator.createPhoneSession("session-1", "+15550000001");
    coordinator.attachTwilioTransport("session-1", transport as never);

    let resolveFirst!: (value: { turn_id: string; say: string; should_end_session: boolean }) => void;
    const first = new Promise<{ turn_id: string; say: string; should_end_session: boolean }>((resolve) => {
      resolveFirst = resolve;
    });

    requestAssist
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (payload: { turn_id: string }) => ({
        turn_id: payload.turn_id,
        say: "fresh reply",
        should_end_session: false,
      }));

    const firstTurn = coordinator.handleHumanTurn("session-1", "caller", "first question");
    await vi.waitFor(() => {
      expect(requestAssist).toHaveBeenCalledTimes(1);
    });

    const secondTurn = coordinator.handleHumanTurn("session-1", "caller", "second question");
    resolveFirst({
      turn_id: "session-1:1",
      say: "stale reply",
      should_end_session: false,
    });

    await Promise.all([firstTurn, secondTurn]);
    await vi.waitFor(() => {
      expect(coordinator.getSession("session-1")?.transcript.map((turn) => turn.text)).toContain("fresh reply");
    });

    expect(coordinator.getSession("session-1")?.transcript.map((turn) => turn.text)).not.toContain("stale reply");
    expect(transport.sentAudio).toHaveLength(3);
  });

  it("queues meeting answers until a natural gap", async () => {
    const { coordinator, requestAssist, sendMeetingAudio } = createCoordinator();
    requestAssist.mockImplementation(async (payload: { turn_id: string }) => ({
      turn_id: payload.turn_id,
      say: "Here is the update.",
      should_end_session: false,
    }));
    const { botId } = await coordinator.createMeetingSession("session-1", "https://meet.google.com/abc-defg-hij");

    await coordinator.handleMeetingTranscript(botId, "Alice", "Voicely can you summarize the roadmap");
    expect(sendMeetingAudio).not.toHaveBeenCalled();

    await coordinator.handleMeetingTranscript(botId, "Alice", "thanks.");
    expect(sendMeetingAudio).toHaveBeenCalledTimes(1);
  });

  it("retries /session-end until it succeeds", async () => {
    vi.useFakeTimers();
    const { coordinator, sendSessionEnd } = createCoordinator();
    sendSessionEnd
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    coordinator.createPhoneSession("session-1", "+15550000001");
    await coordinator.handleTwilioTerminalEvent("session-1", "twilio_stream_closed");

    expect(sendSessionEnd).toHaveBeenCalledTimes(1);
    expect(coordinator.getSession("session-1")?.status).toBe("ending");

    await vi.advanceTimersByTimeAsync(2_000);

    expect(sendSessionEnd).toHaveBeenCalledTimes(2);
    expect(coordinator.getSession("session-1")).toBeUndefined();
    expect(coordinator.getSessionSnapshot("session-1")).toMatchObject({ status: "ended" });
  });

  it("handles duplicate and out-of-order Recall terminal events safely", async () => {
    const { coordinator, sendSessionEnd } = createCoordinator();
    const { botId } = await coordinator.createMeetingSession("session-1", "https://meet.google.com/abc-defg-hij");

    await coordinator.handleMeetingLifecycle(botId, "done");
    await coordinator.handleMeetingLifecycle(botId, "error");

    expect(sendSessionEnd).toHaveBeenCalledTimes(1);
    expect(coordinator.getSession("session-1")).toBeUndefined();
    expect(coordinator.getSessionSnapshot("session-1")).toMatchObject({ status: "ended" });
  });
});

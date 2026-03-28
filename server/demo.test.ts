import { describe, it, expect, afterEach } from "vitest";
import { emitServerEvent, eventBus, type ServerEvent } from "./events";

/**
 * Tests for the demo control panel's server-side contracts.
 * The demo page (src/app/demo/page.tsx) depends on:
 * - SSE events with specific types and data shapes
 * - Bridge API endpoints (/status, /calls/outbound, /meetings/join)
 *
 * These tests verify the event contracts that the demo page relies on.
 */

describe("Demo page SSE event contracts", () => {
  afterEach(() => {
    eventBus.removeAllListeners("serverEvent");
  });

  it("call_started events include direction for demo flow 1 display", () => {
    const received: ServerEvent[] = [];
    eventBus.on("serverEvent", (e: ServerEvent) => received.push(e));

    emitServerEvent("call_started", {
      callSid: "CA123",
      direction: "outbound",
      purpose: "Make a reservation",
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("call_started");
    expect(received[0].data.direction).toBe("outbound");
    expect(received[0].data.purpose).toBe("Make a reservation");
  });

  it("call_ended events arrive after call completion for flow status transition", () => {
    const received: ServerEvent[] = [];
    eventBus.on("serverEvent", (e: ServerEvent) => received.push(e));

    emitServerEvent("call_started", { callSid: "CA123", direction: "outbound" });
    emitServerEvent("call_ended", { callSid: "CA123", duration: 45 });

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe("call_started");
    expect(received[1].type).toBe("call_ended");
  });

  it("tool_invoked events include tool name and args for live activity display", () => {
    const received: ServerEvent[] = [];
    eventBus.on("serverEvent", (e: ServerEvent) => received.push(e));

    emitServerEvent("tool_invoked", {
      tool: "check_calendar",
      args: { date: "2026-03-28" },
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("tool_invoked");
    expect(received[0].data.tool).toBe("check_calendar");
    expect(received[0].data.args).toEqual({ date: "2026-03-28" });
  });

  it("meeting_joined events support demo flow 2 status tracking", () => {
    const received: ServerEvent[] = [];
    eventBus.on("serverEvent", (e: ServerEvent) => received.push(e));

    emitServerEvent("meeting_joined", {
      botId: "bot123",
      meetingUrl: "https://meet.google.com/abc-def-ghi",
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("meeting_joined");
    expect(received[0].data.botId).toBe("bot123");
  });

  it("transcript_update events include speaker and text for live transcript", () => {
    const received: ServerEvent[] = [];
    eventBus.on("serverEvent", (e: ServerEvent) => received.push(e));

    emitServerEvent("transcript_update", {
      botId: "bot123",
      speaker: "Alice",
      text: "Can you check my calendar?",
    });

    expect(received).toHaveLength(1);
    expect(received[0].data.speaker).toBe("Alice");
    expect(received[0].data.text).toBe("Can you check my calendar?");
  });

  it("bot_spoke events include answer text for bot speaking indicator", () => {
    const received: ServerEvent[] = [];
    eventBus.on("serverEvent", (e: ServerEvent) => received.push(e));

    emitServerEvent("bot_spoke", {
      botId: "bot123",
      answer: "You have a meeting at 3pm but are free at 7pm.",
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("bot_spoke");
    expect(received[0].data.answer).toBe(
      "You have a meeting at 3pm but are free at 7pm."
    );
  });

  it("all demo event types emit with ISO timestamps", () => {
    const received: ServerEvent[] = [];
    eventBus.on("serverEvent", (e: ServerEvent) => received.push(e));

    emitServerEvent("call_started", { callSid: "CA1" });
    emitServerEvent("tool_invoked", { tool: "check_calendar" });
    emitServerEvent("meeting_joined", { botId: "b1" });
    emitServerEvent("transcript_update", { speaker: "A", text: "Hi" });
    emitServerEvent("bot_spoke", { answer: "Hello" });
    emitServerEvent("call_ended", { callSid: "CA1" });

    expect(received).toHaveLength(6);
    for (const event of received) {
      expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
    }
  });

  it("demo flow complete lifecycle emits events in correct order", () => {
    const types: string[] = [];
    eventBus.on("serverEvent", (e: ServerEvent) => types.push(e.type));

    // Simulate a full demo call flow
    emitServerEvent("call_started", { callSid: "CA1", direction: "outbound" });
    emitServerEvent("tool_invoked", {
      tool: "check_calendar",
      args: { date: "2026-03-28" },
    });
    emitServerEvent("tool_invoked", {
      tool: "create_calendar_event",
      args: { title: "Dinner", date: "2026-03-28" },
    });
    emitServerEvent("bot_spoke", { answer: "Reservation confirmed!" });
    emitServerEvent("call_ended", { callSid: "CA1" });

    expect(types).toEqual([
      "call_started",
      "tool_invoked",
      "tool_invoked",
      "bot_spoke",
      "call_ended",
    ]);
  });
});

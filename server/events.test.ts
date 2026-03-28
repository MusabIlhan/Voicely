import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  eventBus,
  emitServerEvent,
  getSSEClientCount,
  sseHandler,
  type ServerEvent,
  type ServerEventType,
} from "./events";

// Minimal mock for Express Request/Response used by sseHandler
function createMockReqRes() {
  const written: string[] = [];
  const headersSent: Record<string, string | number> = {};
  let closeListener: (() => void) | null = null;

  const req = {
    on(event: string, listener: () => void) {
      if (event === "close") closeListener = listener;
    },
  } as unknown as import("express").Request;

  const res = {
    writeHead(status: number, headers: Record<string, string>) {
      headersSent["status"] = status;
      Object.assign(headersSent, headers);
    },
    write(chunk: string) {
      written.push(chunk);
      return true;
    },
  } as unknown as import("express").Response;

  return {
    req,
    res,
    written,
    headersSent,
    simulateClose() {
      closeListener?.();
    },
  };
}

describe("emitServerEvent", () => {
  it("emits a typed event through the event bus", () => {
    const received: ServerEvent[] = [];
    const listener = (e: ServerEvent) => received.push(e);
    eventBus.on("serverEvent", listener);

    emitServerEvent("call_started", { callId: "c1" });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("call_started");
    expect(received[0].data.callId).toBe("c1");
    expect(received[0].timestamp).toBeTruthy();

    eventBus.off("serverEvent", listener);
  });

  it("supports all defined event types", () => {
    const types: ServerEventType[] = [
      "call_started",
      "call_ended",
      "tool_invoked",
      "meeting_joined",
      "transcript_update",
      "bot_spoke",
    ];

    const received: ServerEvent[] = [];
    const listener = (e: ServerEvent) => received.push(e);
    eventBus.on("serverEvent", listener);

    for (const t of types) {
      emitServerEvent(t, { test: true });
    }

    expect(received).toHaveLength(types.length);
    expect(received.map((e) => e.type)).toEqual(types);

    eventBus.off("serverEvent", listener);
  });

  it("includes ISO timestamp in each event", () => {
    const received: ServerEvent[] = [];
    const listener = (e: ServerEvent) => received.push(e);
    eventBus.on("serverEvent", listener);

    emitServerEvent("tool_invoked", { tool: "check_calendar_availability" });

    // Should be a valid ISO date
    const ts = received[0].timestamp;
    expect(new Date(ts).toISOString()).toBe(ts);

    eventBus.off("serverEvent", listener);
  });
});

describe("sseHandler", () => {
  afterEach(() => {
    // Remove all listeners to avoid cross-test pollution
    eventBus.removeAllListeners("serverEvent");
  });

  it("sets correct SSE headers", () => {
    const { req, res, headersSent, simulateClose } = createMockReqRes();

    sseHandler(req, res);

    expect(headersSent["status"]).toBe(200);
    expect(headersSent["Content-Type"]).toBe("text/event-stream");
    expect(headersSent["Cache-Control"]).toBe("no-cache");
    expect(headersSent["Connection"]).toBe("keep-alive");

    simulateClose();
  });

  it("sends a connected comment on open", () => {
    const { req, res, written, simulateClose } = createMockReqRes();

    sseHandler(req, res);

    expect(written[0]).toBe(": connected\n\n");

    simulateClose();
  });

  it("forwards server events to the SSE stream as JSON", () => {
    const { req, res, written, simulateClose } = createMockReqRes();

    sseHandler(req, res);

    emitServerEvent("call_started", { callId: "test123" });

    // written[0] = ": connected\n\n", written[1] = the event
    expect(written.length).toBeGreaterThanOrEqual(2);
    const eventLine = written[1];
    expect(eventLine).toMatch(/^data: /);

    const parsed = JSON.parse(eventLine.replace("data: ", "").trim());
    expect(parsed.type).toBe("call_started");
    expect(parsed.data.callId).toBe("test123");

    simulateClose();
  });

  it("increments and decrements client count", () => {
    const initial = getSSEClientCount();

    const { req, res, simulateClose } = createMockReqRes();
    sseHandler(req, res);

    expect(getSSEClientCount()).toBe(initial + 1);

    simulateClose();

    expect(getSSEClientCount()).toBe(initial);
  });

  it("stops forwarding events after client disconnects", () => {
    const { req, res, written, simulateClose } = createMockReqRes();

    sseHandler(req, res);

    const countBefore = written.length;
    simulateClose();

    emitServerEvent("call_ended", { callId: "gone" });

    // No new writes after disconnect
    expect(written.length).toBe(countBefore);
  });

  it("supports multiple concurrent clients", () => {
    const client1 = createMockReqRes();
    const client2 = createMockReqRes();

    sseHandler(client1.req, client1.res);
    sseHandler(client2.req, client2.res);

    emitServerEvent("meeting_joined", { botId: "b1" });

    // Both clients should receive the event
    // client1: ": connected\n\n" + event data
    // client2: ": connected\n\n" + event data
    expect(client1.written.length).toBe(2);
    expect(client2.written.length).toBe(2);

    client1.simulateClose();
    client2.simulateClose();
  });
});

describe("eventBus", () => {
  afterEach(() => {
    eventBus.removeAllListeners("serverEvent");
  });

  it("supports multiple listeners", () => {
    let count1 = 0;
    let count2 = 0;

    const l1 = () => { count1++; };
    const l2 = () => { count2++; };

    eventBus.on("serverEvent", l1);
    eventBus.on("serverEvent", l2);

    emitServerEvent("bot_spoke", { botId: "b1", answer: "Hello" });

    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  it("allows removing a specific listener", () => {
    let count = 0;
    const listener = () => { count++; };

    eventBus.on("serverEvent", listener);
    emitServerEvent("transcript_update", { botId: "b1" });
    expect(count).toBe(1);

    eventBus.off("serverEvent", listener);
    emitServerEvent("transcript_update", { botId: "b1" });
    expect(count).toBe(1); // unchanged
  });
});

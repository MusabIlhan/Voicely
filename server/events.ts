import { EventEmitter } from "events";
import type { Request, Response } from "express";

// ---------------------------------------------------------------------------
// Server-Sent Events (SSE) system for real-time dashboard updates.
// ---------------------------------------------------------------------------

export type ServerEventType =
  | "call_started"
  | "call_ended"
  | "tool_invoked"
  | "meeting_joined"
  | "transcript_update"
  | "bot_spoke";

export interface ServerEvent {
  type: ServerEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

// Central event bus — server-side modules emit events here,
// and SSE clients receive them.
export const eventBus = new EventEmitter();

/** Convenience helper — emit a typed server event. */
export function emitServerEvent(
  type: ServerEventType,
  data: Record<string, unknown>
): void {
  const event: ServerEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };
  eventBus.emit("serverEvent", event);
}

/** Number of currently connected SSE clients. */
let clientCount = 0;

export function getSSEClientCount(): number {
  return clientCount;
}

/**
 * Express handler for `GET /events`.
 * Opens an SSE stream and pushes server events to the client.
 */
export function sseHandler(_req: Request, res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send an initial "connected" comment so the client knows the stream is open
  res.write(": connected\n\n");

  clientCount++;

  const onEvent = (event: ServerEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  eventBus.on("serverEvent", onEvent);

  // Keep-alive every 30 s to prevent proxy/timeout closures
  const keepAlive = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 30_000);

  // Cleanup when client disconnects
  _req.on("close", () => {
    clientCount--;
    eventBus.off("serverEvent", onEvent);
    clearInterval(keepAlive);
  });
}

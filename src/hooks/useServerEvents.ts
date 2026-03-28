"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// React hook for consuming SSE events from the bridge server's /events endpoint.
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

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type ServerEventCallback = (event: ServerEvent) => void;

interface UseServerEventsOptions {
  /** Bridge server URL — defaults to NEXT_PUBLIC_BRIDGE_SERVER_URL or localhost:8080 */
  url?: string;
  /** Auto-reconnect on disconnection (default: true) */
  autoReconnect?: boolean;
  /** Only listen for these event types (default: all) */
  eventTypes?: ServerEventType[];
}

const DEFAULT_URL =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BRIDGE_SERVER_URL
    ? process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL
    : "http://localhost:8080";

export function useServerEvents(
  callback: ServerEventCallback,
  options: UseServerEventsOptions = {}
) {
  const {
    url = DEFAULT_URL,
    autoReconnect = true,
    eventTypes,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const callbackRef = useRef(callback);
  const eventTypesRef = useRef(eventTypes);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs current without re-triggering the effect
  callbackRef.current = callback;
  eventTypesRef.current = eventTypes;

  const connect = useCallback(() => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus("connecting");
    const es = new EventSource(`${url}/events`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus("connected");
    };

    es.onmessage = (msg) => {
      try {
        const event: ServerEvent = JSON.parse(msg.data);
        const filter = eventTypesRef.current;
        if (!filter || filter.includes(event.type)) {
          callbackRef.current(event);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setStatus("disconnected");

      if (autoReconnect) {
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };
  }, [url, autoReconnect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus("disconnected");
    };
  }, [connect]);

  return { status };
}

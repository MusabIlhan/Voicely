"use client";

import { useEffect, useState, useCallback } from "react";
import { useServerEvents, type ServerEvent } from "@/hooks/useServerEvents";

interface CallSession {
  id: string;
  twilioCallSid: string;
  status: "connecting" | "active" | "ended";
  direction: "inbound" | "outbound";
  purpose?: string;
  outcome?: string;
  startedAt: string;
  endedAt?: string;
}

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

export default function CallsPage() {
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/calls`);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
      }
    } catch {
      // Bridge server not reachable
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle real-time call events
  const handleEvent = useCallback(
    (event: ServerEvent) => {
      if (event.type === "call_started" || event.type === "call_ended") {
        fetchCalls();
      }
    },
    [fetchCalls]
  );

  const { status: sseStatus } = useServerEvents(handleEvent, {
    eventTypes: ["call_started", "call_ended", "tool_invoked"],
  });

  useEffect(() => {
    fetchCalls();
    // Fallback polling at reduced frequency
    const id = setInterval(fetchCalls, 30000);
    return () => clearInterval(id);
  }, [fetchCalls]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <section className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Call History
        </h1>
        <p className="mt-2 text-sm text-muted">
          All inbound and outbound calls managed by Voisli
          <span className="ml-2 text-xs text-muted/60">
            Live:{" "}
            <span
              className={
                sseStatus === "connected"
                  ? "text-success"
                  : sseStatus === "connecting"
                    ? "text-yellow-400"
                    : "text-danger"
              }
            >
              {sseStatus}
            </span>
          </span>
        </p>
      </section>

      {loading ? (
        <div className="rounded-xl border border-card-border bg-card px-5 py-10 text-center">
          <p className="text-sm text-muted">Loading calls...</p>
        </div>
      ) : calls.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card px-5 py-10 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="mx-auto h-10 w-10 text-muted/40"
          >
            <path
              fillRule="evenodd"
              d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
              clipRule="evenodd"
            />
          </svg>
          <p className="mt-3 text-sm text-muted">No calls yet</p>
          <p className="mt-1 text-xs text-muted/60">
            Calls will appear here once calls are made through Voisli
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Timeline */}
          <div className="rounded-xl border border-card-border bg-card">
            <div className="border-b border-card-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                Timeline
              </h2>
            </div>
            <ul className="divide-y divide-card-border">
              {calls.map((call) => (
                <CallRow key={call.id} call={call} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function CallRow({ call }: { call: CallSession }) {
  const startDate = new Date(call.startedAt);
  const endDate = call.endedAt ? new Date(call.endedAt) : null;

  const duration = endDate
    ? formatDuration(endDate.getTime() - startDate.getTime())
    : call.status !== "ended"
      ? "In progress"
      : "\u2014";

  const directionLabel = call.direction === "inbound" ? "Inbound" : "Outbound";
  const directionIcon = call.direction === "inbound" ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M10 18a.75.75 0 01-.75-.75V4.66L7.3 6.76a.75.75 0 11-1.1-1.02l3.25-3.5a.75.75 0 011.1 0l3.25 3.5a.75.75 0 01-1.1 1.02l-1.95-2.1v12.59A.75.75 0 0110 18z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v12.59l1.95-2.1a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 111.1-1.02l1.95 2.1V2.75A.75.75 0 0110 2z" clipRule="evenodd" />
    </svg>
  );

  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {/* Direction indicator */}
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              call.direction === "inbound"
                ? "bg-accent/20 text-accent-light"
                : "bg-success/20 text-success"
            }`}
          >
            {directionIcon}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {directionLabel} Call
              </span>
              <StatusBadge status={call.status} />
            </div>

            {call.purpose && (
              <p className="mt-1 text-xs text-muted truncate">
                {call.purpose}
              </p>
            )}

            {call.outcome && (
              <p className="mt-1 text-xs text-success/80">
                Outcome: {call.outcome}
              </p>
            )}

            <p className="mt-1 text-xs text-muted/60">
              {call.twilioCallSid || call.id.slice(0, 8)}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-sm text-accent-light">{duration}</p>
          <p className="mt-1 text-xs text-muted/60">
            {startDate.toLocaleString()}
          </p>
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: CallSession["status"] }) {
  const styles = {
    connecting: "bg-yellow-500/10 text-yellow-400",
    active: "bg-success/10 text-success",
    ended: "bg-muted/10 text-muted",
  };

  const labels = {
    connecting: "Connecting",
    active: "Active",
    ended: "Ended",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "connecting"
            ? "bg-yellow-500"
            : status === "active"
              ? "bg-success"
              : "bg-muted"
        }`}
      />
      {labels[status]}
    </span>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

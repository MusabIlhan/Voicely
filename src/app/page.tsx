"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import StatusCard from "@/components/StatusCard";
import ActiveCalls from "@/components/ActiveCalls";
import { useServerEvents, type ServerEvent } from "@/hooks/useServerEvents";

interface BridgeStatus {
  activeCalls: number;
  uptime: number;
  configuredServices: {
    twilio: boolean;
    gemini: boolean;
  };
}

interface RecentCall {
  id: string;
  twilioCallSid: string;
  status: "connecting" | "active" | "ended";
  direction: "inbound" | "outbound";
  purpose?: string;
  outcome?: string;
  startedAt: string;
  endedAt?: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

export default function Home() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [online, setOnline] = useState(false);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [activeMeetings, setActiveMeetings] = useState(0);
  const [callLoading, setCallLoading] = useState(false);
  const [callResult, setCallResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);

  const addActivity = useCallback((type: string, message: string, timestamp: string) => {
    setActivityFeed((prev) => {
      const entry: ActivityEntry = {
        id: crypto.randomUUID(),
        type,
        message,
        timestamp,
      };
      return [entry, ...prev].slice(0, 20);
    });
  }, []);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/calls`);
      if (res.ok) {
        const data = await res.json();
        setRecentCalls((data.calls ?? []).slice(0, 5));
      }
    } catch {
      // Bridge not available
    }
  }, []);

  // Handle real-time events
  const handleEvent = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case "call_started": {
          const dir = (event.data.direction as string) ?? "inbound";
          addActivity(event.type, `${dir} call started`, event.timestamp);
          fetchCalls();
          setStatus((prev) =>
            prev ? { ...prev, activeCalls: prev.activeCalls + 1 } : prev
          );
          break;
        }
        case "call_ended": {
          const dir = (event.data.direction as string) ?? "";
          addActivity(event.type, `${dir} call ended`, event.timestamp);
          fetchCalls();
          setStatus((prev) =>
            prev
              ? { ...prev, activeCalls: Math.max(0, prev.activeCalls - 1) }
              : prev
          );
          break;
        }
        case "tool_invoked": {
          const tool = (event.data.tool as string) ?? "unknown";
          addActivity(event.type, `Tool invoked: ${tool}`, event.timestamp);
          break;
        }
        case "meeting_joined": {
          const url = (event.data.meetingUrl as string) ?? "";
          addActivity(event.type, `Bot joined meeting: ${url.slice(0, 40)}`, event.timestamp);
          setActiveMeetings((prev) => prev + 1);
          break;
        }
        case "transcript_update": {
          const speaker = (event.data.speaker as string) ?? "";
          const text = (event.data.text as string) ?? "";
          addActivity(event.type, `${speaker}: ${text.slice(0, 60)}`, event.timestamp);
          break;
        }
        case "bot_spoke": {
          const answer = (event.data.answer as string) ?? "";
          addActivity(event.type, `Bot spoke: ${answer.slice(0, 60)}`, event.timestamp);
          break;
        }
      }
    },
    [addActivity, fetchCalls]
  );

  const { status: sseStatus } = useServerEvents(handleEvent);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`${BRIDGE_URL}/status`);
        if (res.ok) {
          setStatus(await res.json());
          setOnline(true);
        } else {
          setOnline(false);
        }
      } catch {
        setOnline(false);
        setStatus(null);
      }
    }

    async function fetchMeetings() {
      try {
        const res = await fetch(`${BRIDGE_URL}/meetings`);
        if (res.ok) {
          const data = await res.json();
          const sessions = data.sessions ?? [];
          setActiveMeetings(
            sessions.filter(
              (s: { status: string }) =>
                s.status === "creating" ||
                s.status === "joining" ||
                s.status === "in_call"
            ).length
          );
        }
      } catch {
        // Bridge not available
      }
    }

    fetchStatus();
    fetchCalls();
    fetchMeetings();
    // Polling as fallback — reduced frequency since SSE provides real-time updates
    const id = setInterval(() => {
      fetchStatus();
      fetchCalls();
      fetchMeetings();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchCalls]);

  async function handleTestCall() {
    setCallLoading(true);
    setCallResult(null);
    try {
      const res = await fetch(`${BRIDGE_URL}/calls/outbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: "+15551234567",
          purpose:
            "Make a reservation for 2 people tonight at 7pm under the name Smith",
        }),
      });
      const data = await res.json();
      setCallResult({
        success: res.ok,
        message: res.ok
          ? "Test call initiated successfully"
          : data.error || "Failed to initiate call",
      });
      if (res.ok) fetchCalls();
    } catch {
      setCallResult({
        success: false,
        message: "Could not reach bridge server",
      });
    } finally {
      setCallLoading(false);
    }
  }

  const twilioReady = status?.configuredServices.twilio ?? false;
  const geminiReady = status?.configuredServices.gemini ?? false;
  const activeCalls = status?.activeCalls ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Hero */}
      <section className="mb-10 animate-fade-in">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Voisli
        </h1>
        <p className="mt-2 text-lg text-muted">Your AI Voice Assistant</p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              sseStatus === "connected"
                ? "bg-success animate-pulse-dot"
                : sseStatus === "connecting"
                  ? "bg-warning animate-pulse-dot"
                  : "bg-danger"
            }`}
          />
          <span className="text-xs text-muted/60">
            Live updates:{" "}
            <span
              className={
                sseStatus === "connected"
                  ? "text-success"
                  : sseStatus === "connecting"
                    ? "text-warning"
                    : "text-danger"
              }
            >
              {sseStatus}
            </span>
          </span>
        </div>
      </section>

      {/* Key Metrics — large, projector-friendly */}
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-6 animate-fade-in">
          <p className="text-sm font-medium text-muted">Active Calls</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="metric-xl text-foreground tabular-nums">
              {activeCalls}
            </span>
            {activeCalls > 0 && (
              <div className="mb-1.5 flex items-center gap-0.5 h-4">
                <span className="waveform-bar" />
                <span className="waveform-bar" />
                <span className="waveform-bar" />
              </div>
            )}
          </div>
        </div>
        <div className="glass-card rounded-xl p-6 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <p className="text-sm font-medium text-muted">Active Meetings</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="metric-xl text-foreground tabular-nums">
              {activeMeetings}
            </span>
            {activeMeetings > 0 && (
              <span className="mb-2 h-2.5 w-2.5 rounded-full bg-success animate-pulse-dot" />
            )}
          </div>
        </div>
        <div className="glass-card rounded-xl p-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <p className="text-sm font-medium text-muted">Uptime</p>
          <span className="mt-2 block metric-xl text-foreground tabular-nums">
            {online && status ? formatUptime(status.uptime) : "--"}
          </span>
        </div>
      </section>

      {/* Status Cards */}
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatusCard
          label="Bridge Server"
          status={online ? "online" : "offline"}
          detail={
            online && status
              ? `${Math.floor(status.uptime / 1000)}s uptime`
              : undefined
          }
        />
        <StatusCard
          label="Twilio"
          status={
            !online ? "unknown" : twilioReady ? "online" : "offline"
          }
        />
        <StatusCard
          label="Gemini"
          status={
            !online ? "unknown" : geminiReady ? "online" : "offline"
          }
        />
      </section>

      {/* Active Calls */}
      <section className="mb-8">
        <ActiveCalls calls={[]} />
      </section>

      {/* Active Meetings */}
      <section className="mb-8 glass-card rounded-xl p-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 text-accent-light"
              >
                <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Active Meetings
              </h2>
              <p className="text-sm text-muted">
                {activeMeetings === 0
                  ? "No bots in meetings"
                  : `${activeMeetings} bot${activeMeetings !== 1 ? "s" : ""} in meetings`}
              </p>
            </div>
          </div>
          <Link
            href="/meetings"
            className="text-sm text-accent-light hover:text-accent transition-colors"
          >
            View all
          </Link>
        </div>
      </section>

      {/* Make a Test Call */}
      <section className="mb-8 glass-card rounded-xl p-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Make a Test Call
            </h2>
            <p className="mt-1 text-sm text-muted">
              Trigger an outbound call to a test restaurant number
            </p>
          </div>
          <button
            onClick={handleTestCall}
            disabled={callLoading || !online}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-light hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {callLoading ? "Calling..." : "Place Test Call"}
          </button>
        </div>
        {callResult && (
          <p
            className={`mt-3 text-sm animate-fade-in ${callResult.success ? "text-success" : "text-danger"}`}
          >
            {callResult.message}
          </p>
        )}
      </section>

      {/* Live Activity Feed */}
      <section className="mb-8 glass-card rounded-xl">
        <div className="flex items-center justify-between border-b border-card-border/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Live Activity
            </h2>
            {activityFeed.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
            )}
          </div>
          <span className="text-xs text-muted">Real-time events</span>
        </div>
        {activityFeed.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted/10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-muted/40">
                <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-muted">No live events yet</p>
            <p className="mt-1 text-xs text-muted/60">
              Events will appear here in real-time as calls and meetings happen
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-card-border/50 max-h-72 overflow-y-auto scroll-shadow">
            {activityFeed.map((entry, i) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 px-5 py-2.5 animate-slide-in"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <EventIcon type={entry.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">
                    {entry.message}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted/60 tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent Call Activity */}
      <section className="mb-8 glass-card rounded-xl">
        <div className="flex items-center justify-between border-b border-card-border/50 px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Activity
          </h2>
          <Link
            href="/calls"
            className="text-sm text-accent-light hover:text-accent transition-colors"
          >
            View all
          </Link>
        </div>
        {recentCalls.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted/10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-muted/40">
                <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-muted">No recent calls</p>
          </div>
        ) : (
          <ul className="divide-y divide-card-border/50">
            {recentCalls.map((call, i) => (
              <li
                key={call.id}
                className="flex items-center justify-between px-5 py-3 animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      call.direction === "inbound"
                        ? "bg-accent/20 text-accent-light"
                        : "bg-success/20 text-success"
                    }`}
                  >
                    {call.direction === "inbound" ? "\u2193" : "\u2191"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground capitalize">
                        {call.direction}
                      </p>
                      {call.status === "active" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
                      )}
                    </div>
                    {call.purpose && (
                      <p className="text-xs text-muted truncate max-w-xs">
                        {call.purpose}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium capitalize ${
                    call.status === "active"
                      ? "text-success"
                      : call.status === "connecting"
                        ? "text-warning"
                        : "text-muted"
                  }`}
                >
                  {call.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick Setup */}
      {(!twilioReady || !geminiReady) && (
        <section className="mb-8 glass-card rounded-xl p-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-foreground">
            Quick Setup
          </h2>
          <p className="mt-1 text-sm text-muted">
            Configure these environment variables in your{" "}
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-accent-light">
              .env
            </code>{" "}
            file to get started.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <EnvRow
              ready={twilioReady}
              name="TWILIO_ACCOUNT_SID"
              description="Twilio Account SID"
            />
            <EnvRow
              ready={twilioReady}
              name="TWILIO_AUTH_TOKEN"
              description="Twilio Auth Token"
            />
            <EnvRow
              ready={twilioReady}
              name="TWILIO_PHONE_NUMBER"
              description="Twilio Phone Number"
            />
            <EnvRow
              ready={geminiReady}
              name="GEMINI_API_KEY"
              description="Google Gemini API Key"
            />
          </ul>
        </section>
      )}

      {/* How to Test */}
      <section className="glass-card rounded-xl p-6 animate-fade-in">
        <h2 className="text-lg font-semibold text-foreground">How to Test</h2>
        <ol className="mt-4 space-y-3 text-sm text-muted">
          <Step
            n={1}
            text="Configure your .env file with Twilio and Gemini API credentials"
          />
          <Step
            n={2}
            text="Start ngrok to expose the bridge server: ngrok http 8080"
          />
          <Step
            n={3}
            text="Set the ngrok URL as PUBLIC_SERVER_URL in .env and configure the Twilio webhook to point to it"
          />
          <Step
            n={4}
            text="Call your Twilio phone number — you'll be connected to the Gemini voice AI"
          />
        </ol>
      </section>
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  const iconMap: Record<string, { bg: string; label: string }> = {
    call_started: { bg: "bg-success/20 text-success", label: "C" },
    call_ended: { bg: "bg-muted/20 text-muted", label: "C" },
    tool_invoked: { bg: "bg-yellow-500/20 text-yellow-400", label: "T" },
    meeting_joined: { bg: "bg-accent/20 text-accent-light", label: "M" },
    transcript_update: { bg: "bg-accent/20 text-accent-light", label: "S" },
    bot_spoke: { bg: "bg-success/20 text-success", label: "B" },
  };
  const { bg, label } = iconMap[type] ?? {
    bg: "bg-muted/20 text-muted",
    label: "?",
  };
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${bg}`}
    >
      {label}
    </span>
  );
}

function EnvRow({
  ready,
  name,
  description,
}: {
  ready: boolean;
  name: string;
  description: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className={`text-base ${ready ? "text-success" : "text-danger"}`}>
        {ready ? "\u2713" : "\u2717"}
      </span>
      <code className="font-mono text-xs text-accent-light">{name}</code>
      <span className="text-muted/60">&mdash; {description}</span>
    </li>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-light">
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useServerEvents, type ServerEvent } from "@/hooks/useServerEvents";

type MeetingBotStatus =
  | "creating"
  | "joining"
  | "in_call"
  | "leaving"
  | "done"
  | "error";

interface MeetingSession {
  botId: string;
  meetingUrl: string;
  status: MeetingBotStatus;
  participants: { name: string; speakerId: string }[];
  startedAt: string;
  endedAt?: string;
}

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

export default function MeetingsPage() {
  const [sessions, setSessions] = useState<MeetingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [botName, setBotName] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinResult, setJoinResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/meetings`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // Bridge server not reachable
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time SSE updates for meeting events
  const handleEvent = useCallback(
    (event: ServerEvent) => {
      if (
        event.type === "meeting_joined" ||
        event.type === "transcript_update" ||
        event.type === "bot_spoke"
      ) {
        fetchMeetings();
      }
    },
    [fetchMeetings]
  );

  const { status: sseStatus } = useServerEvents(handleEvent, {
    eventTypes: ["meeting_joined", "transcript_update", "bot_spoke"],
  });

  useEffect(() => {
    fetchMeetings();
    // Fallback polling at reduced frequency (SSE handles real-time)
    const id = setInterval(fetchMeetings, 30000);
    return () => clearInterval(id);
  }, [fetchMeetings]);

  async function handleJoinMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!meetingUrl.trim()) return;

    setJoinLoading(true);
    setJoinResult(null);
    try {
      const res = await fetch(`${BRIDGE_URL}/meetings/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingUrl: meetingUrl.trim(),
          botName: botName.trim() || undefined,
        }),
      });
      const data = await res.json();
      setJoinResult({
        success: res.ok,
        message: res.ok
          ? "Bot is joining the meeting"
          : data.error || "Failed to join meeting",
      });
      if (res.ok) {
        setMeetingUrl("");
        setBotName("");
      }
    } catch {
      setJoinResult({
        success: false,
        message: "Could not reach bridge server",
      });
    } finally {
      setJoinLoading(false);
    }
  }

  const activeSessions = sessions.filter(
    (s) => s.status === "creating" || s.status === "joining" || s.status === "in_call"
  );
  const pastSessions = sessions.filter(
    (s) => s.status === "done" || s.status === "leaving" || s.status === "error"
  );

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-6 md:py-10">
      {/* Header */}
      <section className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold nexgen-heading text-foreground">
          Meetings
        </h1>
        <p className="mt-2 text-sm text-muted">
          Send an AI assistant to join and participate in Google Meet calls
          <span className="ml-2 inline-flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                sseStatus === "connected"
                  ? "bg-success animate-pulse-dot"
                  : sseStatus === "connecting"
                    ? "bg-warning animate-pulse-dot"
                    : "bg-danger"
              }`}
            />
            <span className="text-xs text-muted/60">{sseStatus}</span>
          </span>
        </p>
      </section>

      {/* Join a Meeting */}
      <section className="mb-8 glass-card rounded-2xl p-6 animate-fade-in">
        <h2 className="text-lg font-semibold nexgen-heading text-foreground">
          Join a Meeting
        </h2>
        <p className="mt-1 text-sm text-muted">
          Paste a Google Meet URL to send the Voisli assistant
        </p>
        <form onSubmit={handleJoinMeeting} className="mt-4 space-y-3">
          <input
            type="url"
            placeholder="https://meet.google.com/abc-defg-hij"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            required
            className="nexgen-input w-full rounded-2xl border border-card-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 transition-all"
          />
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">
                Bot name (optional)
              </label>
              <input
                type="text"
                placeholder="Voisli Assistant"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                className="nexgen-input w-full rounded-2xl border border-card-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={joinLoading || !meetingUrl.trim()}
              className="nexgen-btn nexgen-btn-primary px-5 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none"
            >
              {joinLoading ? "Joining..." : "Send Bot"}
            </button>
          </div>
        </form>
        {joinResult && (
          <p
            className={`mt-3 text-sm animate-fade-in ${joinResult.success ? "text-success" : "text-danger"}`}
          >
            {joinResult.message}
          </p>
        )}
      </section>

      {/* Active Meetings */}
      <section className="mb-8 glass-card rounded-2xl">
        <div className="border-b border-card-border px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold nexgen-heading text-foreground">
              Active Meetings
            </h2>
            {activeSessions.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
            )}
          </div>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <p className="mt-3 text-sm text-muted">Loading meetings...</p>
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6 text-accent/40"
              >
                <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-muted">No active meetings</p>
            <p className="mt-1 text-xs text-muted/60">
              Join a meeting above to get started
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-card-border">
            {activeSessions.map((session, i) => (
              <MeetingRow key={session.botId} session={session} index={i} />
            ))}
          </ul>
        )}
      </section>

      {/* Past Meetings */}
      {pastSessions.length > 0 && (
        <section className="glass-card rounded-2xl animate-fade-in">
          <div className="border-b border-card-border px-5 py-4">
            <h2 className="text-lg font-semibold nexgen-heading text-foreground">
              Past Meetings
            </h2>
          </div>
          <ul className="divide-y divide-card-border">
            {pastSessions.map((session, i) => (
              <MeetingRow key={session.botId} session={session} index={i} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MeetingRow({ session, index }: { session: MeetingSession; index: number }) {
  const startDate = new Date(session.startedAt);
  const endDate = session.endedAt ? new Date(session.endedAt) : null;

  const duration = endDate
    ? formatDuration(endDate.getTime() - startDate.getTime())
    : session.status === "done"
      ? "\u2014"
      : "In progress";

  const isActive = session.status === "in_call" || session.status === "joining" || session.status === "creating";

  return (
    <li
      className="px-5 py-4 animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM15.75 8.25l3.032-2.19A.75.75 0 0120 6.72v6.56a.75.75 0 01-1.218.59L15.75 11.68V8.25z" />
            </svg>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/meetings/${session.botId}`}
                className="text-sm font-medium text-foreground hover:text-accent transition-colors"
              >
                Meeting
              </Link>
              <MeetingStatusBadge status={session.status} />
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
              )}
            </div>

            <p className="mt-1 text-xs text-muted truncate max-w-sm">
              {session.meetingUrl}
            </p>

            {session.participants.length > 0 && (
              <p className="mt-1 text-xs text-muted/60">
                {session.participants.length} participant{session.participants.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-sm text-accent tabular-nums">{duration}</p>
          <p className="mt-1 text-xs text-muted/60">
            {startDate.toLocaleString()}
          </p>
          <Link
            href={`/meetings/${session.botId}`}
            className="mt-1 inline-block text-xs font-medium text-accent hover:text-accent-light transition-colors"
          >
            View details
          </Link>
        </div>
      </div>
    </li>
  );
}

function MeetingStatusBadge({ status }: { status: MeetingBotStatus }) {
  const styles: Record<MeetingBotStatus, string> = {
    creating: "bg-amber-500/8 text-amber-600",
    joining: "bg-amber-500/8 text-amber-600",
    in_call: "bg-success/8 text-success",
    leaving: "bg-muted/8 text-muted",
    done: "bg-muted/8 text-muted",
    error: "bg-danger/8 text-danger",
  };

  const labels: Record<MeetingBotStatus, string> = {
    creating: "Creating",
    joining: "Joining",
    in_call: "In Call",
    leaving: "Leaving",
    done: "Ended",
    error: "Error",
  };

  const dotColors: Record<MeetingBotStatus, string> = {
    creating: "bg-amber-500 animate-pulse-dot",
    joining: "bg-amber-500 animate-pulse-dot",
    in_call: "bg-success animate-pulse-dot",
    leaving: "bg-muted",
    done: "bg-muted",
    error: "bg-danger",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColors[status]}`} />
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

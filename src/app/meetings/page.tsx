"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
    async function fetchMeetings() {
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
    }

    fetchMeetings();
    const id = setInterval(fetchMeetings, 5000);
    return () => clearInterval(id);
  }, []);

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
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <section className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Meetings
        </h1>
        <p className="mt-2 text-sm text-muted">
          Send an AI assistant to join and participate in Google Meet calls
        </p>
      </section>

      {/* Join a Meeting */}
      <section className="mb-8 glass-card rounded-xl p-6 animate-fade-in">
        <h2 className="text-lg font-semibold text-foreground">
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
            className="w-full rounded-lg border border-card-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
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
                className="w-full rounded-lg border border-card-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={joinLoading || !meetingUrl.trim()}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-light hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
      <section className="mb-8 glass-card rounded-xl">
        <div className="border-b border-card-border/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
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
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6 text-muted/30"
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
          <ul className="divide-y divide-card-border/50">
            {activeSessions.map((session, i) => (
              <MeetingRow key={session.botId} session={session} index={i} />
            ))}
          </ul>
        )}
      </section>

      {/* Past Meetings */}
      {pastSessions.length > 0 && (
        <section className="glass-card rounded-xl animate-fade-in">
          <div className="border-b border-card-border/50 px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Past Meetings
            </h2>
          </div>
          <ul className="divide-y divide-card-border/50">
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
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-light">
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
                className="text-sm font-medium text-foreground hover:text-accent-light transition-colors"
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
          <p className="font-mono text-sm text-accent-light tabular-nums">{duration}</p>
          <p className="mt-1 text-xs text-muted/60">
            {startDate.toLocaleString()}
          </p>
          <Link
            href={`/meetings/${session.botId}`}
            className="mt-1 inline-block text-xs text-accent-light hover:text-accent transition-colors"
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
    creating: "bg-yellow-500/10 text-yellow-400",
    joining: "bg-yellow-500/10 text-yellow-400",
    in_call: "bg-success/10 text-success",
    leaving: "bg-muted/10 text-muted",
    done: "bg-muted/10 text-muted",
    error: "bg-danger/10 text-danger",
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
    creating: "bg-yellow-500 animate-pulse-dot",
    joining: "bg-yellow-500 animate-pulse-dot",
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

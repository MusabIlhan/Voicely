"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
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

interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
}

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

export default function MeetingDetailPage() {
  const params = useParams<{ botId: string }>();
  const botId = params.botId;

  const [session, setSession] = useState<MeetingSession | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/meetings/${botId}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
      } else {
        setError("Meeting session not found");
      }
    } catch {
      setError("Could not reach bridge server");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  const fetchTranscript = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/meetings/${botId}/transcript`);
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript ?? []);
      }
    } catch {
      // Silently fail
    }
  }, [botId]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/meetings/${botId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary ?? "");
      }
    } catch {
      // Silently fail
    }
  }, [botId]);

  // Real-time event handler — stream transcript updates live
  const handleEvent = useCallback(
    (event: ServerEvent) => {
      if (event.type === "transcript_update" && event.data.botId === botId) {
        const newEntry: TranscriptEntry = {
          speaker: (event.data.speaker as string) ?? "",
          text: (event.data.text as string) ?? "",
          timestamp: (event.data.timestamp as string) ?? event.timestamp,
        };
        setTranscript((prev) => [...prev, newEntry]);
        // Auto-scroll to bottom
        setTimeout(() => {
          transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }

      if (event.type === "bot_spoke" && event.data.botId === botId) {
        // Refresh session to pick up any status changes
        fetchSession();
      }
    },
    [botId, fetchSession]
  );

  useServerEvents(handleEvent, {
    eventTypes: ["transcript_update", "bot_spoke"],
  });

  useEffect(() => {
    fetchSession();
    fetchTranscript();
    fetchSummary();
    // Fallback polling at reduced frequency
    const id = setInterval(() => {
      fetchSession();
      fetchTranscript();
      fetchSummary();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchSession, fetchTranscript, fetchSummary]);

  async function handleLeave() {
    setLeaveLoading(true);
    try {
      await fetch(`${BRIDGE_URL}/meetings/${botId}/leave`, {
        method: "POST",
      });
    } catch {
      // Silently fail
    } finally {
      setLeaveLoading(false);
    }
  }

  const isActive =
    session?.status === "creating" ||
    session?.status === "joining" ||
    session?.status === "in_call";

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-xl border border-card-border bg-card px-5 py-10 text-center">
          <p className="text-sm text-muted">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-xl border border-card-border bg-card px-5 py-10 text-center">
          <p className="text-sm text-danger">{error || "Meeting not found"}</p>
          <Link
            href="/meetings"
            className="mt-3 inline-block text-sm text-accent-light hover:text-accent transition-colors"
          >
            Back to meetings
          </Link>
        </div>
      </div>
    );
  }

  const startDate = new Date(session.startedAt);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/meetings"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          &larr; Back to meetings
        </Link>
      </div>

      {/* Header */}
      <section className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Meeting
            </h1>
            <MeetingStatusBadge status={session.status} />
          </div>
          <p className="mt-2 text-sm text-muted truncate max-w-lg">
            {session.meetingUrl}
          </p>
          <p className="mt-1 text-xs text-muted/60">
            Started {startDate.toLocaleString()}
          </p>
        </div>
        {isActive && (
          <button
            onClick={handleLeave}
            disabled={leaveLoading}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {leaveLoading ? "Leaving..." : "Leave Meeting"}
          </button>
        )}
      </section>

      {/* Info Cards */}
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-card-border bg-card p-4">
          <p className="text-xs font-medium text-muted">Status</p>
          <p className="mt-1 text-lg font-semibold text-foreground capitalize">
            {session.status.replace("_", " ")}
          </p>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <p className="text-xs font-medium text-muted">Participants</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {session.participants.length}
          </p>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <p className="text-xs font-medium text-muted">Transcript Lines</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {transcript.length}
          </p>
        </div>
      </section>

      {/* Participants */}
      {session.participants.length > 0 && (
        <section className="mb-8 rounded-xl border border-card-border bg-card">
          <div className="border-b border-card-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Participants
            </h2>
          </div>
          <ul className="divide-y divide-card-border">
            {session.participants.map((p) => (
              <li
                key={p.speakerId}
                className="flex items-center gap-3 px-5 py-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-light">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-foreground">{p.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Summary */}
      {summary && (
        <section className="mb-8 rounded-xl border border-card-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            AI Summary
          </h2>
          <p className="mt-3 text-sm text-muted whitespace-pre-wrap">
            {summary}
          </p>
        </section>
      )}

      {/* Transcript */}
      <section className="rounded-xl border border-card-border bg-card">
        <div className="border-b border-card-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Live Transcript
          </h2>
        </div>
        {transcript.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted">No transcript entries yet</p>
            <p className="mt-1 text-xs text-muted/60">
              Transcript will stream in real-time as people speak in the meeting
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-card-border max-h-[32rem] overflow-y-auto">
            {transcript.map((entry, i) => {
              const time = new Date(entry.timestamp);
              return (
                <li key={i} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-light mt-0.5">
                      {entry.speaker.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {entry.speaker}
                        </span>
                        <span className="text-xs text-muted/60">
                          {time.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">{entry.text}</p>
                    </div>
                  </div>
                </li>
              );
            })}
            <div ref={transcriptEndRef} />
          </ul>
        )}
      </section>
    </div>
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
    creating: "bg-yellow-500",
    joining: "bg-yellow-500",
    in_call: "bg-success",
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

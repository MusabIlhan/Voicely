"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  isBotSpeech?: boolean;
  isToolInvocation?: boolean;
  toolName?: string;
  toolResult?: string;
}

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

const SPEAKER_COLORS = [
  { bg: "bg-violet-500/10", text: "text-violet-600", dot: "bg-violet-500" },
  { bg: "bg-cyan-500/10", text: "text-cyan-600", dot: "bg-cyan-500" },
  { bg: "bg-amber-500/10", text: "text-amber-600", dot: "bg-amber-500" },
  { bg: "bg-rose-500/10", text: "text-rose-600", dot: "bg-rose-500" },
  { bg: "bg-emerald-500/10", text: "text-emerald-600", dot: "bg-emerald-500" },
  { bg: "bg-blue-500/10", text: "text-blue-600", dot: "bg-blue-500" },
  { bg: "bg-orange-500/10", text: "text-orange-600", dot: "bg-orange-500" },
  { bg: "bg-pink-500/10", text: "text-pink-600", dot: "bg-pink-500" },
];

const BOT_COLOR = { bg: "bg-success/10", text: "text-success", dot: "bg-success" };

function getSpeakerColor(speaker: string, speakerMap: Map<string, number>) {
  if (speaker.toLowerCase().includes("voisli") || speaker.toLowerCase().includes("bot")) {
    return BOT_COLOR;
  }
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size);
  }
  const idx = speakerMap.get(speaker)!;
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

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
  const speakerMapRef = useRef(new Map<string, number>());

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

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      if (event.type === "transcript_update" && event.data.botId === botId) {
        const newEntry: TranscriptEntry = {
          speaker: (event.data.speaker as string) ?? "",
          text: (event.data.text as string) ?? "",
          timestamp: (event.data.timestamp as string) ?? event.timestamp,
        };
        setTranscript((prev) => [...prev, newEntry]);
        setTimeout(() => {
          transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }

      if (event.type === "bot_spoke" && event.data.botId === botId) {
        const botEntry: TranscriptEntry = {
          speaker: "Voisli Bot",
          text: (event.data.answer as string) ?? "",
          timestamp: event.timestamp,
          isBotSpeech: true,
        };
        setTranscript((prev) => [...prev, botEntry]);
        fetchSession();
        setTimeout(() => {
          transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }

      if (event.type === "tool_invoked" && event.data.botId === botId) {
        const toolEntry: TranscriptEntry = {
          speaker: "System",
          text: `${(event.data.tool as string) ?? "unknown"}`,
          timestamp: event.timestamp,
          isToolInvocation: true,
          toolName: (event.data.tool as string) ?? "unknown",
          toolResult: (event.data.result as string) ?? undefined,
        };
        setTranscript((prev) => [...prev, toolEntry]);
      }
    },
    [botId, fetchSession]
  );

  useServerEvents(handleEvent, {
    eventTypes: ["transcript_update", "bot_spoke", "tool_invoked"],
  });

  useEffect(() => {
    fetchSession();
    fetchTranscript();
    fetchSummary();
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

  const speakerColors = useMemo(() => {
    const map = speakerMapRef.current;
    return transcript.map((entry) => getSpeakerColor(entry.speaker, map));
  }, [transcript]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <div className="glass-card rounded-2xl px-5 py-10 text-center animate-fade-in">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="mt-3 text-sm text-muted">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <div className="glass-card rounded-2xl px-5 py-10 text-center animate-fade-in">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/8">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-danger">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="mt-3 text-sm text-danger">{error || "Meeting not found"}</p>
          <Link
            href="/meetings"
            className="mt-3 inline-block text-sm font-medium text-accent hover:text-accent-light transition-colors"
          >
            Back to meetings
          </Link>
        </div>
      </div>
    );
  }

  const startDate = new Date(session.startedAt);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-6 md:py-10">
      {/* Breadcrumb */}
      <div className="mb-6 animate-fade-in">
        <Link
          href="/meetings"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          &larr; Back to meetings
        </Link>
      </div>

      {/* Header */}
      <section className="mb-8 flex items-start justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold nexgen-heading text-foreground">
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
            className="nexgen-btn rounded-2xl bg-danger px-4 py-2 text-sm font-medium text-white transition-all hover:bg-danger/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {leaveLoading ? "Leaving..." : "Leave Meeting"}
          </button>
        )}
      </section>

      {/* Info Cards */}
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5 animate-fade-in">
          <p className="section-label">Status</p>
          <p className="mt-2 flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground capitalize">
              {session.status.replace("_", " ")}
            </span>
            {isActive && (
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
            )}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <p className="section-label">Participants</p>
          <p className="mt-2 text-lg font-semibold text-foreground tabular-nums">
            {session.participants.length}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <p className="section-label">Transcript Lines</p>
          <p className="mt-2 text-lg font-semibold text-foreground tabular-nums">
            {transcript.length}
          </p>
        </div>
      </section>

      {/* Participants */}
      {session.participants.length > 0 && (
        <section className="mb-8 glass-card rounded-2xl animate-fade-in">
          <div className="border-b border-card-border px-5 py-4">
            <h2 className="text-lg font-semibold nexgen-heading text-foreground">
              Participants
            </h2>
          </div>
          <ul className="divide-y divide-card-border">
            {session.participants.map((p, i) => {
              const color = getSpeakerColor(p.name, speakerMapRef.current);
              return (
                <li
                  key={p.speakerId}
                  className="flex items-center gap-3 px-5 py-3 animate-fade-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${color.bg} text-xs font-bold ${color.text}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm text-foreground">{p.name}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Summary */}
      {summary && (
        <section className="mb-8 glass-card rounded-2xl p-6 animate-fade-in">
          <h2 className="text-lg font-semibold nexgen-heading text-foreground">
            AI Summary
          </h2>
          <p className="mt-3 text-sm text-muted whitespace-pre-wrap leading-relaxed">
            {summary}
          </p>
        </section>
      )}

      {/* Transcript */}
      <section className="glass-card rounded-2xl animate-fade-in">
        <div className="border-b border-card-border px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold nexgen-heading text-foreground">
              Live Transcript
            </h2>
            {isActive && (
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
            )}
          </div>
        </div>
        {transcript.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/8">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-muted/40">
                <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-muted">No transcript entries yet</p>
            <p className="mt-1 text-xs text-muted/60">
              Transcript will stream in real-time as people speak in the meeting
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-card-border/50 max-h-[36rem] overflow-y-auto scroll-shadow">
            {transcript.map((entry, i) => {
              const time = new Date(entry.timestamp);
              const color = speakerColors[i];

              if (entry.isToolInvocation) {
                return (
                  <li key={i} className="px-5 py-2 animate-slide-in">
                    <div className="flex items-center gap-2 rounded-xl bg-amber-500/5 border border-amber-500/15 px-3 py-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500/10 text-[10px] font-bold text-amber-600">
                        T
                      </span>
                      <span className="text-xs text-amber-600 font-medium">
                        Tool: {entry.toolName}
                      </span>
                      {entry.toolResult && (
                        <span className="text-xs text-muted/60 truncate">
                          &rarr; {entry.toolResult}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-muted/40 tabular-nums">
                        {time.toLocaleTimeString()}
                      </span>
                    </div>
                  </li>
                );
              }

              if (entry.isBotSpeech) {
                return (
                  <li
                    key={i}
                    className="px-5 py-3 bg-success/3 border-l-2 border-l-success/30 animate-slide-in"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-xl ${BOT_COLOR.bg} text-xs font-bold ${BOT_COLOR.text} mt-0.5`}>
                        V
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${BOT_COLOR.text}`}>
                            {entry.speaker}
                          </span>
                          <span className="rounded-full bg-success/8 px-1.5 py-0.5 text-[10px] font-medium text-success">
                            AI Response
                          </span>
                          <span className="text-xs text-muted/60 tabular-nums">
                            {time.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-foreground">{entry.text}</p>
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li key={i} className="px-5 py-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-xl ${color.bg} text-xs font-bold ${color.text} mt-0.5`}>
                      {entry.speaker.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${color.text}`}>
                          {entry.speaker}
                        </span>
                        <span className="text-xs text-muted/60 tabular-nums">
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

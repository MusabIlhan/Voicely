"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useServerEvents, type ServerEvent } from "@/hooks/useServerEvents";

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

type DemoStatus = "ready" | "in_progress" | "completed";

interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
  isBotSpeech?: boolean;
  isToolInvocation?: boolean;
  toolName?: string;
}

const MCP_CONFIG = `{
  "mcpServers": {
    "voisli": {
      "command": "npx",
      "args": ["tsx", "server/mcp/index.ts"],
      "cwd": "/path/to/voisli",
      "env": {
        "BRIDGE_SERVER_URL": "http://localhost:8080"
      }
    }
  }
}`;

const MCP_TOOLS = [
  { name: "make_call", desc: "Initiate a phone call through the AI assistant" },
  { name: "join_meeting", desc: "Send a bot to join a video meeting" },
  { name: "leave_meeting", desc: "Remove the bot from a meeting" },
  { name: "check_calendar", desc: "Check calendar availability" },
  { name: "create_calendar_event", desc: "Create a new calendar event" },
  { name: "get_call_status", desc: "Check status of a phone call" },
  { name: "get_meeting_summary", desc: "Get AI summary of a meeting" },
  { name: "get_meeting_transcript", desc: "Get full meeting transcript" },
];

export default function DemoPage() {
  // Onboarding
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  const [ngrokUrl, setNgrokUrl] = useState<string | null>(null);
  const [calendarReady, setCalendarReady] = useState(false);

  // Server status
  const [serverOnline, setServerOnline] = useState(false);
  const [twilioReady, setTwilioReady] = useState(false);
  const [geminiReady, setGeminiReady] = useState(false);
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);

  // Demo Flow 1: Restaurant Reservation
  const [flow1Status, setFlow1Status] = useState<DemoStatus>("ready");
  const [callLoading, setCallLoading] = useState(false);
  const [callSid, setCallSid] = useState<string | null>(null);
  const [callActivity, setCallActivity] = useState<ActivityEntry[]>([]);

  // Demo Flow 2: Meeting Assistant
  const [flow2Status, setFlow2Status] = useState<DemoStatus>("ready");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meetingBotId, setMeetingBotId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [botSpeaking, setBotSpeaking] = useState(false);
  const [simQuestion, setSimQuestion] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Demo Flow 3: MCP Integration
  const [flow3Status, setFlow3Status] = useState<DemoStatus>("ready");
  const [mcpLog, setMcpLog] = useState<ActivityEntry[]>([]);
  const [copied, setCopied] = useState(false);

  // Refs for status tracking inside callbacks
  const flow1Ref = useRef(flow1Status);
  const flow2Ref = useRef(flow2Status);
  const flow3Ref = useRef(flow3Status);
  flow1Ref.current = flow1Status;
  flow2Ref.current = flow2Status;
  flow3Ref.current = flow3Status;

  // Fetch server status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`${BRIDGE_URL}/status`);
        if (res.ok) {
          const data = await res.json();
          setServerOnline(true);
          setTwilioReady(data.configuredServices?.twilio ?? false);
          setGeminiReady(data.configuredServices?.gemini ?? false);
          setCalendarReady(data.configuredServices?.calendar ?? false);
          setTwilioNumber(data.twilioNumber ?? null);
          setNgrokUrl(data.publicServerUrl ?? null);
        } else {
          setServerOnline(false);
        }
      } catch {
        setServerOnline(false);
      }
    }
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, []);

  // SSE event handler
  const handleEvent = useCallback((event: ServerEvent) => {
    const now = event.timestamp;

    switch (event.type) {
      case "call_started": {
        const entry: ActivityEntry = {
          id: crypto.randomUUID(),
          type: "call_started",
          message: `Call started (${(event.data.direction as string) ?? "outbound"})`,
          timestamp: now,
        };
        setCallActivity((prev) => [entry, ...prev].slice(0, 30));
        if (flow1Ref.current === "ready") setFlow1Status("in_progress");
        break;
      }
      case "call_ended": {
        const entry: ActivityEntry = {
          id: crypto.randomUUID(),
          type: "call_ended",
          message: "Call ended",
          timestamp: now,
        };
        setCallActivity((prev) => [entry, ...prev].slice(0, 30));
        if (flow1Ref.current === "in_progress") setFlow1Status("completed");
        break;
      }
      case "tool_invoked": {
        const tool = (event.data.tool as string) ?? "unknown";
        const args = event.data.args
          ? JSON.stringify(event.data.args).slice(0, 80)
          : "";
        const callEntry: ActivityEntry = {
          id: crypto.randomUUID(),
          type: "tool_invoked",
          message: `Tool: ${tool}${args ? ` \u2014 ${args}` : ""}`,
          timestamp: now,
        };
        setCallActivity((prev) => [callEntry, ...prev].slice(0, 30));

        const mcpEntry: ActivityEntry = {
          id: crypto.randomUUID(),
          type: "tool_invoked",
          message: `${tool}${args ? ` \u2014 ${args}` : ""}`,
          timestamp: now,
        };
        setMcpLog((prev) => [mcpEntry, ...prev].slice(0, 30));
        if (flow3Ref.current === "ready") setFlow3Status("in_progress");
        break;
      }
      case "meeting_joined": {
        if (flow2Ref.current === "ready") setFlow2Status("in_progress");
        break;
      }
      case "transcript_update": {
        const newEntry: TranscriptEntry = {
          speaker: (event.data.speaker as string) ?? "",
          text: (event.data.text as string) ?? "",
          timestamp: (event.data.timestamp as string) ?? now,
        };
        setTranscript((prev) => [...prev, newEntry]);
        setTimeout(() => {
          transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
        break;
      }
      case "bot_spoke": {
        const botEntry: TranscriptEntry = {
          speaker: "Voisli Bot",
          text: (event.data.answer as string) ?? "",
          timestamp: now,
          isBotSpeech: true,
        };
        setTranscript((prev) => [...prev, botEntry]);
        setBotSpeaking(true);
        setTimeout(() => setBotSpeaking(false), 3000);
        setTimeout(() => {
          transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);

        const entry: ActivityEntry = {
          id: crypto.randomUUID(),
          type: "bot_spoke",
          message: `AI: ${((event.data.answer as string) ?? "").slice(0, 80)}`,
          timestamp: now,
        };
        setCallActivity((prev) => [entry, ...prev].slice(0, 30));
        break;
      }
    }
  }, []);

  useServerEvents(handleEvent);

  // Demo Flow 1: Start call
  async function handleStartCall() {
    setCallLoading(true);
    setCallActivity([]);
    setFlow1Status("in_progress");
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
      if (res.ok) {
        setCallSid(data.callSid ?? null);
      } else {
        setCallActivity((prev) => [
          {
            id: crypto.randomUUID(),
            type: "error",
            message: data.error || "Failed to start call",
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        setFlow1Status("ready");
      }
    } catch {
      setCallActivity((prev) => [
        {
          id: crypto.randomUUID(),
          type: "error",
          message: "Could not reach bridge server",
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
      setFlow1Status("ready");
    } finally {
      setCallLoading(false);
    }
  }

  // Demo Flow 2: Join meeting
  async function handleJoinMeeting() {
    if (!meetingUrl.trim()) return;
    setMeetingLoading(true);
    setTranscript([]);
    setFlow2Status("in_progress");
    try {
      const res = await fetch(`${BRIDGE_URL}/meetings/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingUrl: meetingUrl.trim(),
          botName: "Voisli Demo",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMeetingBotId(data.botId ?? null);
      } else {
        setFlow2Status("ready");
      }
    } catch {
      setFlow2Status("ready");
    } finally {
      setMeetingLoading(false);
    }
  }

  // "Ask the Bot" simulation — adds a fake question + response to transcript
  function handleSimulateAsk() {
    if (!simQuestion.trim()) return;
    const now = new Date().toISOString();
    const questionEntry: TranscriptEntry = {
      speaker: "Presenter",
      text: `Hey Voisli, ${simQuestion.trim()}`,
      timestamp: now,
    };
    const responseEntry: TranscriptEntry = {
      speaker: "Voisli Bot",
      text: "(Generating response...)",
      timestamp: now,
      isBotSpeech: true,
    };
    setTranscript((prev) => [...prev, questionEntry, responseEntry]);
    setSimQuestion("");
    setBotSpeaking(true);
    setTimeout(() => setBotSpeaking(false), 3000);
    setTimeout(() => {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  function handleCopyConfig() {
    navigator.clipboard.writeText(MCP_CONFIG).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Hero */}
      <section className="mb-10 animate-fade-in">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Demo Day
          </h1>
          <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent-light">
            Live
          </span>
        </div>
        <p className="mt-2 text-lg text-muted">
          Hackathon presentation control panel &mdash; run all three demo flows
          from one page
        </p>
        {/* Server status bar */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <StatusPill label="Bridge Server" ready={serverOnline} />
          <StatusPill label="Twilio" ready={twilioReady} />
          <StatusPill label="Gemini" ready={geminiReady} />
        </div>
      </section>

      {/* ── Onboarding: Connect Claude to Your Phone ────────────── */}
      <section className="mb-8 glass-card rounded-xl animate-fade-in">
        <button
          onClick={() => setOnboardingOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-accent-light">
                <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Connect Claude to Your Phone
              </h2>
              <p className="text-sm text-muted">
                3 steps to give Claude a real phone number
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <OnboardingProgress
              steps={[twilioReady, geminiReady, serverOnline && twilioReady && geminiReady]}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-5 w-5 text-muted transition-transform duration-200 ${onboardingOpen ? "rotate-180" : ""}`}
            >
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </button>

        {onboardingOpen && (
          <div className="border-t border-card-border/50 px-5 py-5 space-y-1">
            {/* Step 1: Your Phone Number */}
            <OnboardingStep
              step={1}
              title="Get a Phone Number"
              done={twilioReady}
            >
              <p className="text-sm text-muted mb-3">
                Claude needs a real phone number to make and receive calls. We use Twilio for this.
              </p>
              {twilioNumber ? (
                <div className="rounded-lg border border-success/20 bg-success/5 p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-success">
                      <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-success font-medium">Claude&apos;s phone number</p>
                    <p className="text-xl font-bold text-foreground tracking-wide">{twilioNumber}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-card-border bg-background p-3">
                  <p className="text-xs text-muted/60">
                    Sign up at <span className="text-accent-light">twilio.com</span>, get a phone number, and add credentials to <code className="text-accent-light">.env</code>
                  </p>
                </div>
              )}
            </OnboardingStep>

            {/* Step 2: Connect Claude */}
            <OnboardingStep
              step={2}
              title="Give Claude the Tools"
              done={geminiReady}
            >
              <p className="text-sm text-muted mb-3">
                Paste this config into Claude Desktop or Claude Code. One paste — Claude gets {MCP_TOOLS.length} new abilities.
              </p>
              <div className="relative rounded-lg border border-card-border bg-background p-3">
                <button
                  onClick={handleCopyConfig}
                  className="absolute right-2 top-2 rounded-md bg-card-border/50 px-2 py-0.5 text-[10px] font-medium text-muted hover:text-foreground transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <pre className="font-mono text-[11px] text-muted leading-relaxed overflow-x-auto pr-14">{MCP_CONFIG}</pre>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {MCP_TOOLS.slice(0, 4).map((tool) => (
                  <code
                    key={tool.name}
                    className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-light"
                  >
                    {tool.name}
                  </code>
                ))}
                <span className="rounded bg-card-border/30 px-1.5 py-0.5 text-[10px] text-muted">
                  +{MCP_TOOLS.length - 4} more
                </span>
              </div>
            </OnboardingStep>

            {/* Step 3: Try It */}
            <OnboardingStep
              step={3}
              title="Try It"
              done={serverOnline && twilioReady && geminiReady}
              isLast
            >
              <p className="text-sm text-muted mb-3">
                Pick up your phone and try either:
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px] rounded-lg border border-card-border bg-background p-4">
                  <p className="text-sm font-medium text-foreground mb-1">Call Claude</p>
                  <p className="text-xs text-muted/60">
                    Dial{" "}
                    <code className="text-accent-light font-semibold">{twilioNumber ?? "the number above"}</code>{" "}
                    from your phone. The AI picks up and talks to you.
                  </p>
                </div>
                <div className="flex-1 min-w-[200px] rounded-lg border border-card-border bg-background p-4">
                  <p className="text-sm font-medium text-foreground mb-1">Tell Claude to call</p>
                  <p className="text-xs text-muted/60">
                    In Claude, type: &ldquo;Call the restaurant at +1234567890 and book a table for 2 tonight at 7pm&rdquo;
                  </p>
                </div>
              </div>
            </OnboardingStep>
          </div>
        )}
      </section>

      {/* ── Demo Flow 1: Restaurant Reservation ──────────────────────── */}
      <section className="mb-8 glass-card rounded-xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-card-border/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 text-accent-light"
              >
                <path
                  fillRule="evenodd"
                  d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Flow 1: Restaurant Reservation
              </h2>
              <p className="text-sm text-muted">
                AI calls a restaurant to make a reservation
              </p>
            </div>
          </div>
          <FlowStatusBadge status={flow1Status} />
        </div>
        <div className="p-5">
          {/* Twilio number & Start button */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {twilioNumber && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Twilio #:</span>
                <code className="rounded bg-background px-2 py-1 font-mono text-sm text-accent-light">
                  {twilioNumber}
                </code>
              </div>
            )}
            <button
              onClick={handleStartCall}
              disabled={callLoading || !serverOnline}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-light hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {callLoading ? "Starting..." : "Start Demo Call"}
            </button>
            {callSid && (
              <span className="text-xs text-muted/60 font-mono">
                SID: {callSid}
              </span>
            )}
          </div>

          {/* Live activity feed */}
          <div className="rounded-lg border border-card-border/50 bg-background/50">
            <div className="flex items-center gap-2 border-b border-card-border/30 px-4 py-2">
              <span className="text-xs font-medium text-muted">
                Live Activity
              </span>
              {flow1Status === "in_progress" && (
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
              )}
            </div>
            {callActivity.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-muted/60">
                  Start a demo call to see live AI activity here
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-card-border/30 max-h-48 overflow-y-auto scroll-shadow">
                {callActivity.map((entry, i) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 px-4 py-2 animate-slide-in"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <DemoEventIcon type={entry.type} />
                    <span className="flex-1 text-xs text-foreground truncate">
                      {entry.message}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted/50 tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── Demo Flow 2: Meeting Assistant ───────────────────────────── */}
      <section
        className="mb-8 glass-card rounded-xl animate-fade-in"
        style={{ animationDelay: "100ms" }}
      >
        <div className="flex items-center justify-between border-b border-card-border/50 px-5 py-4">
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
                Flow 2: Meeting Assistant
              </h2>
              <p className="text-sm text-muted">
                AI bot joins a meeting, transcribes, and answers questions
              </p>
            </div>
          </div>
          <FlowStatusBadge status={flow2Status} />
        </div>
        <div className="p-5">
          {/* Join meeting input */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="Paste Google Meet URL..."
              className="flex-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              onClick={handleJoinMeeting}
              disabled={meetingLoading || !serverOnline || !meetingUrl.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-light hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {meetingLoading ? "Joining..." : "Join Meeting"}
            </button>
          </div>

          {/* Bot speaking indicator */}
          {botSpeaking && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-success/5 border border-success/20 px-3 py-2 animate-fade-in">
              <div className="flex items-center gap-0.5 h-4">
                <span className="waveform-bar" />
                <span className="waveform-bar" />
                <span className="waveform-bar" />
              </div>
              <span className="text-xs font-medium text-success">
                Bot is speaking...
              </span>
            </div>
          )}

          {meetingBotId && (
            <p className="mb-3 text-xs text-muted/60 font-mono">
              Bot ID: {meetingBotId}
            </p>
          )}

          {/* Live transcript */}
          <div className="rounded-lg border border-card-border/50 bg-background/50 mb-4">
            <div className="flex items-center gap-2 border-b border-card-border/30 px-4 py-2">
              <span className="text-xs font-medium text-muted">
                Live Transcript
              </span>
              {flow2Status === "in_progress" && (
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
              )}
            </div>
            {transcript.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-muted/60">
                  Join a meeting to see the live transcript here
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-card-border/30 max-h-64 overflow-y-auto scroll-shadow">
                {transcript.map((entry, i) => (
                  <li
                    key={i}
                    className={`px-4 py-2 animate-fade-in ${
                      entry.isBotSpeech
                        ? "bg-success/5 border-l-2 border-l-success/40"
                        : entry.isToolInvocation
                          ? "bg-yellow-500/5"
                          : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium ${
                          entry.isBotSpeech
                            ? "text-success"
                            : entry.isToolInvocation
                              ? "text-yellow-400"
                              : "text-accent-light"
                        }`}
                      >
                        {entry.speaker}
                      </span>
                      <span className="text-[10px] text-muted/50 tabular-nums">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/80">
                      {entry.text}
                    </p>
                  </li>
                ))}
                <div ref={transcriptEndRef} />
              </ul>
            )}
          </div>

          {/* Ask the Bot simulation */}
          <div className="flex gap-3">
            <input
              type="text"
              value={simQuestion}
              onChange={(e) => setSimQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSimulateAsk()}
              placeholder="Simulate a question to the bot..."
              className="flex-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              onClick={handleSimulateAsk}
              disabled={!simQuestion.trim()}
              className="rounded-lg border border-card-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-card-border/50 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              Ask Bot
            </button>
          </div>
          <p className="mt-1 text-[10px] text-muted/40">
            Fallback: adds a simulated transcript entry for demo purposes
          </p>
        </div>
      </section>

      {/* ── Demo Flow 3: MCP Integration ─────────────────────────────── */}
      <section
        className="mb-8 glass-card rounded-xl animate-fade-in"
        style={{ animationDelay: "200ms" }}
      >
        <div className="flex items-center justify-between border-b border-card-border/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 text-accent-light"
              >
                <path
                  fillRule="evenodd"
                  d="M14.447 3.027a.75.75 0 01.527.92l-4.5 16.5a.75.75 0 01-1.448-.394l4.5-16.5a.75.75 0 01.921-.526zM16.72 6.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L21.44 12l-4.72-4.72a.75.75 0 010-1.06zm-9.44 0a.75.75 0 010 1.06L2.56 12l4.72 4.72a.75.75 0 11-1.06 1.06L.97 12.53a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Flow 3: MCP Integration
              </h2>
              <p className="text-sm text-muted">
                Claude invokes Voisli tools via Model Context Protocol
              </p>
            </div>
          </div>
          <FlowStatusBadge status={flow3Status} />
        </div>
        <div className="p-5 space-y-4">
          {/* Tool list */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">
              Available MCP Tools ({MCP_TOOLS.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {MCP_TOOLS.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-start gap-2 rounded-lg border border-card-border/30 bg-background/50 px-3 py-2"
                >
                  <code className="shrink-0 rounded bg-card px-1.5 py-0.5 font-mono text-[11px] text-accent-light">
                    {tool.name}
                  </code>
                  <span className="text-xs text-muted">{tool.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live MCP log */}
          <div className="rounded-lg border border-card-border/50 bg-background/50">
            <div className="flex items-center gap-2 border-b border-card-border/30 px-4 py-2">
              <span className="text-xs font-medium text-muted">
                Live MCP Tool Invocations
              </span>
              {mcpLog.length > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse-dot" />
              )}
            </div>
            {mcpLog.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-muted/60">
                  MCP tool invocations will appear here when Claude calls Voisli
                  tools
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-card-border/30 max-h-40 overflow-y-auto scroll-shadow">
                {mcpLog.map((entry, i) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 px-4 py-2 animate-slide-in"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-yellow-500/20 text-[10px] font-bold text-yellow-400">
                      T
                    </span>
                    <span className="flex-1 text-xs text-foreground truncate">
                      {entry.message}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted/50 tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* MCP Config snippet */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">
              Claude Configuration
            </h3>
            <div className="relative">
              <button
                onClick={handleCopyConfig}
                className="absolute right-3 top-3 rounded-md bg-card-border/50 px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <pre className="overflow-x-auto rounded-lg border border-card-border bg-background p-4 font-mono text-xs text-foreground leading-relaxed">
                {MCP_CONFIG}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${
          ready ? "bg-success animate-pulse-dot" : "bg-danger"
        }`}
      />
      <span className="text-xs text-muted">
        {label}:{" "}
        <span className={ready ? "text-success" : "text-danger"}>
          {ready ? "Online" : "Offline"}
        </span>
      </span>
    </div>
  );
}

function FlowStatusBadge({ status }: { status: DemoStatus }) {
  const styles: Record<DemoStatus, string> = {
    ready: "bg-muted/10 text-muted",
    in_progress: "bg-success/10 text-success",
    completed: "bg-accent/10 text-accent-light",
  };
  const labels: Record<DemoStatus, string> = {
    ready: "Ready",
    in_progress: "In Progress",
    completed: "Completed",
  };
  const dots: Record<DemoStatus, string> = {
    ready: "bg-muted",
    in_progress: "bg-success animate-pulse-dot",
    completed: "bg-accent-light",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />
      {labels[status]}
    </span>
  );
}

function OnboardingProgress({ steps }: { steps: boolean[] }) {
  const done = steps.filter(Boolean).length;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted tabular-nums">
        {done}/{steps.length}
      </span>
      <div className="flex gap-0.5">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`h-1.5 w-4 rounded-full transition-colors duration-300 ${
              s ? "bg-success" : "bg-card-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function OnboardingStep({
  step,
  title,
  done,
  isLast,
  children,
}: {
  step: number;
  title: string;
  done: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300 ${
            done
              ? "bg-success/20 text-success"
              : "bg-card-border/50 text-muted"
          }`}
        >
          {done ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
          ) : (
            step
          )}
        </div>
        {!isLast && (
          <div
            className={`w-px flex-1 my-1 transition-colors duration-300 ${
              done ? "bg-success/30" : "bg-card-border/30"
            }`}
          />
        )}
      </div>
      {/* Content */}
      <div className={`pb-5 ${isLast ? "" : ""}`}>
        <h3 className="text-sm font-semibold text-foreground mb-1.5">
          {title}
          {done && (
            <span className="ml-2 text-[10px] font-medium text-success">
              Connected
            </span>
          )}
        </h3>
        {children}
      </div>
    </div>
  );
}

function StatusCheck({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {ready ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-success">
          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
        </svg>
      ) : (
        <span className="h-3.5 w-3.5 flex items-center justify-center">
          <span className="h-1.5 w-1.5 rounded-full bg-muted/40" />
        </span>
      )}
      <span className={`text-[11px] ${ready ? "text-success/80" : "text-muted/50"}`}>
        {label}
      </span>
    </div>
  );
}

function DemoEventIcon({ type }: { type: string }) {
  const iconMap: Record<string, { bg: string; label: string }> = {
    call_started: { bg: "bg-success/20 text-success", label: "C" },
    call_ended: { bg: "bg-muted/20 text-muted", label: "C" },
    tool_invoked: { bg: "bg-yellow-500/20 text-yellow-400", label: "T" },
    bot_spoke: { bg: "bg-success/20 text-success", label: "B" },
    error: { bg: "bg-danger/20 text-danger", label: "!" },
  };
  const { bg, label } = iconMap[type] ?? {
    bg: "bg-muted/20 text-muted",
    label: "?",
  };
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${bg}`}
    >
      {label}
    </span>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

interface OnboardingProps {
  onComplete: (user: { id: number; email: string }) => void;
}

const TOTAL_STEPS = 4;

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Step content */}
        <div key={step} className="animate-step-enter">
          {step === 0 && <StepHook />}
          {step === 1 && <StepCapabilities />}
          {step === 2 && <StepDemo />}
          {step === 3 && <StepSignup onComplete={onComplete} />}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <div>
            {step > 0 && step < 3 && (
              <button
                onClick={back}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Back
              </button>
            )}
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all ${
                  i === step
                    ? "w-6 bg-accent"
                    : i < step
                      ? "w-2 bg-accent/50"
                      : "w-2 bg-card-border"
                }`}
              />
            ))}
          </div>

          <div>
            {step < 3 ? (
              <button
                onClick={next}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-all hover:bg-accent-light hover:scale-105 active:scale-95"
              >
                Next
              </button>
            ) : (
              <Link
                href="/login"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Log in instead
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 0: The Hook ─── */
function StepHook() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-10 w-10 text-accent-light"
        >
          <path
            fillRule="evenodd"
            d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Give your AI a voice
      </h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-muted">
        Voisli connects AI agents to phone calls, meetings, and calendars.
        One server. Full voice capabilities.
      </p>

      {/* Connection diagram */}
      <div className="mt-10 flex items-center justify-center gap-4">
        <div className="glass-card rounded-xl px-4 py-3 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <p className="text-xs text-muted">AI Agent</p>
          <p className="text-sm font-semibold text-foreground">Claude</p>
        </div>
        <div className="flex items-center gap-1 animate-fade-in" style={{ animationDelay: "250ms" }}>
          <span className="h-px w-6 bg-accent/50" />
          <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-mono text-accent-light">MCP</span>
          <span className="h-px w-6 bg-accent/50" />
        </div>
        <div className="glass-card rounded-xl px-4 py-3 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <p className="text-xs text-muted">Bridge</p>
          <p className="text-sm font-semibold text-accent-light">Voisli</p>
        </div>
        <div className="flex items-center animate-fade-in" style={{ animationDelay: "550ms" }}>
          <span className="h-px w-6 bg-accent/50" />
        </div>
        <div className="flex flex-col gap-2 animate-fade-in" style={{ animationDelay: "700ms" }}>
          <span className="rounded-lg bg-success/10 px-3 py-1 text-xs font-medium text-success">Phone</span>
          <span className="rounded-lg bg-accent/10 px-3 py-1 text-xs font-medium text-accent-light">Meetings</span>
          <span className="rounded-lg bg-warning/10 px-3 py-1 text-xs font-medium text-warning">Calendar</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1: Capabilities ─── */
function StepCapabilities() {
  const capabilities = [
    {
      title: "Voice Calls",
      description: "AI makes and receives calls via Twilio. It speaks, listens, and executes tasks autonomously.",
      tools: ["make_call", "get_call_status"],
      icon: (
        <path
          fillRule="evenodd"
          d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
          clipRule="evenodd"
        />
      ),
      color: "success",
    },
    {
      title: "Meeting Bots",
      description: "Send a bot into Zoom, Meet, or Teams. Get live transcription and summaries.",
      tools: ["join_meeting", "get_meeting_summary"],
      icon: (
        <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
      ),
      color: "accent-light",
    },
    {
      title: "Calendar",
      description: "Check availability and create events. Your agent manages your schedule.",
      tools: ["check_calendar", "create_calendar_event"],
      icon: (
        <path
          fillRule="evenodd"
          d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z"
          clipRule="evenodd"
        />
      ),
      color: "warning",
    },
  ] as const;

  return (
    <div>
      <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
        Three capabilities, one server
      </h2>
      <p className="mt-2 text-center text-muted">
        Everything your AI agent needs to interact with the real world.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {capabilities.map((cap, i) => (
          <div
            key={cap.title}
            className="glass-card rounded-xl p-5 animate-fade-in"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${cap.color}/20`}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`h-5 w-5 text-${cap.color}`}
              >
                {cap.icon}
              </svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">{cap.title}</h3>
            <p className="mt-1 text-xs text-muted leading-relaxed">{cap.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {cap.tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-accent-light"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step 2: Demo ─── */
function StepDemo() {
  const lines = [
    { type: "prompt" as const, text: '"Call Mario\'s Pizza at +1-555-0123 and reserve a table for 4 at 7pm tonight"' },
    { type: "system" as const, text: "Using make_call..." },
    { type: "system" as const, text: "Call connected. AI negotiating reservation." },
    { type: "result" as const, text: "Reservation confirmed for 4 at 7:00 PM under your name." },
  ];

  return (
    <div>
      <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
        One prompt. Real results.
      </h2>
      <p className="mt-2 text-center text-muted">
        Your AI agent handles the entire conversation autonomously.
      </p>

      {/* Terminal mockup */}
      <div className="mx-auto mt-8 max-w-lg">
        <div className="rounded-xl border border-card-border bg-background overflow-hidden">
          {/* Terminal header */}
          <div className="flex items-center gap-2 border-b border-card-border px-4 py-2.5">
            <span className="h-3 w-3 rounded-full bg-danger/60" />
            <span className="h-3 w-3 rounded-full bg-warning/60" />
            <span className="h-3 w-3 rounded-full bg-success/60" />
            <span className="ml-2 text-xs text-muted/60 font-mono">claude</span>
          </div>

          {/* Terminal body */}
          <div className="p-4 font-mono text-sm space-y-3">
            {lines.map((line, i) => (
              <div
                key={i}
                className="animate-slide-in"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                {line.type === "prompt" && (
                  <div className="flex gap-2">
                    <span className="text-accent-light shrink-0">&gt;</span>
                    <span className="text-foreground">{line.text}</span>
                  </div>
                )}
                {line.type === "system" && (
                  <div className="flex items-center gap-2">
                    {line.text.includes("connected") && (
                      <span className="flex items-center gap-0.5 h-4">
                        <span className="waveform-bar" />
                        <span className="waveform-bar" />
                        <span className="waveform-bar" />
                      </span>
                    )}
                    <span className="text-muted">{line.text}</span>
                  </div>
                )}
                {line.type === "result" && (
                  <div className="rounded-lg bg-success/10 px-3 py-2">
                    <span className="text-success">{line.text}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted/60">
          This is a real flow. Voisli handles the entire phone conversation with AI.
        </p>
      </div>
    </div>
  );
}

/* ─── Step 3: Sign Up ─── */
function StepSignup({ onComplete }: { onComplete: (user: { id: number; email: string }) => void }) {
  return (
    <div className="mx-auto max-w-sm">
      <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
        Get started in under 2 minutes
      </h2>
      <p className="mt-2 text-center text-muted">
        Create an account, connect your API keys, and your AI is ready to call.
      </p>

      <div className="mt-8 glass-card rounded-2xl p-6">
        <SignupForm
          onSuccess={onComplete}
          buttonLabel="Create Account & Get Started"
        />
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-accent-light hover:text-accent transition-colors"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

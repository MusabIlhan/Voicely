"use client";

import { useState } from "react";

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

interface SetupWizardProps {
  onComplete: () => void;
}

const STEPS = [
  { label: "MCP", icon: "code" },
  { label: "Gemini", icon: "ai" },
  { label: "Calendar", icon: "calendar" },
] as const;

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      onComplete();
    }
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function skip() {
    onComplete();
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted">
              Setup {step + 1} of {STEPS.length}
            </h2>
            <button
              onClick={skip}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Skip setup
            </button>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < step
                      ? "bg-success"
                      : i === step
                        ? "bg-accent"
                        : "bg-card-border"
                  }`}
                />
                <p
                  className={`mt-1.5 text-xs font-medium ${
                    i <= step ? "text-foreground" : "text-muted/40"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div key={step} className="animate-step-enter">
          {step === 0 && <StepMCP />}
          {step === 1 && <StepGemini />}
          {step === 2 && <StepCalendar />}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <div>
            {step > 0 && (
              <button
                onClick={back}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <button
            onClick={next}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-light hover:scale-105 active:scale-95"
          >
            {step < STEPS.length - 1 ? "Continue" : "Finish Setup"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 0: MCP Setup ─── */
function StepMCP() {
  const [copied, setCopied] = useState(false);

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        voisli: {
          command: "npx",
          args: ["tsx", "server/mcp/index.ts"],
          cwd: "/path/to/voisli",
          env: {
            BRIDGE_SERVER_URL: BRIDGE_URL,
          },
        },
      },
    },
    null,
    2
  );

  function handleCopy() {
    navigator.clipboard.writeText(mcpConfig).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6 text-accent"
          >
            <path
              fillRule="evenodd"
              d="M14.447 3.027a.75.75 0 01.527.92l-4.5 16.5a.75.75 0 01-1.448-.394l4.5-16.5a.75.75 0 01.921-.526zM16.72 6.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L21.44 12l-4.72-4.72a.75.75 0 010-1.06zm-9.44 0a.75.75 0 010 1.06L2.56 12l4.72 4.72a.75.75 0 11-1.06 1.06L.97 12.53a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Connect Claude via MCP
          </h2>
          <p className="text-sm text-muted">
            Let Claude control calls, meetings, and your calendar
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Add to your Claude config
          </h3>
          <p className="text-xs text-muted mb-3">
            Paste this into your{" "}
            <code className="rounded bg-sidebar-bg px-1.5 py-0.5 font-mono text-accent-light">
              claude_desktop_config.json
            </code>{" "}
            or{" "}
            <code className="rounded bg-sidebar-bg px-1.5 py-0.5 font-mono text-accent-light">
              .mcp.json
            </code>{" "}
            file. Update the{" "}
            <code className="rounded bg-sidebar-bg px-1.5 py-0.5 font-mono text-accent-light">
              cwd
            </code>{" "}
            path to where you cloned Voisli.
          </p>

          <div className="relative">
            <button
              onClick={handleCopy}
              className="absolute right-3 top-3 rounded-lg bg-background/80 px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <pre className="overflow-x-auto rounded-xl border border-card-border bg-sidebar-bg p-4 font-mono text-xs text-foreground leading-relaxed">
              {mcpConfig}
            </pre>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Where to paste
          </h3>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent">
                1
              </span>
              <span>
                <span className="font-medium text-foreground">Claude Desktop:</span>{" "}
                Settings &rarr; Developer &rarr; Edit Config
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent">
                2
              </span>
              <span>
                <span className="font-medium text-foreground">Claude Code:</span>{" "}
                Add to your project&apos;s{" "}
                <code className="rounded bg-sidebar-bg px-1 py-0.5 font-mono text-[11px] text-accent-light">
                  .mcp.json
                </code>
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 shrink-0 text-accent"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-accent leading-relaxed">
              Make sure the Voisli bridge server is running (
              <code className="font-mono">npm run dev</code>) before using MCP
              tools. The bridge server URL is set to{" "}
              <code className="font-mono font-semibold">{BRIDGE_URL}</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1: Gemini API ─── */
function StepGemini() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6 text-success"
          >
            <path d="M16.5 7.5h-9v9h9v-9z" />
            <path
              fillRule="evenodd"
              d="M8.25 2.25A.75.75 0 019 3v.75h2.25V3a.75.75 0 011.5 0v.75H15V3a.75.75 0 011.5 0v.75h.75a3 3 0 013 3v.75H21A.75.75 0 0121 9h-.75v2.25H21a.75.75 0 010 1.5h-.75V15H21a.75.75 0 010 1.5h-.75v.75a3 3 0 01-3 3h-.75V21a.75.75 0 01-1.5 0v-.75h-2.25V21a.75.75 0 01-1.5 0v-.75H9V21a.75.75 0 01-1.5 0v-.75h-.75a3 3 0 01-3-3v-.75H3A.75.75 0 013 15h.75v-2.25H3a.75.75 0 010-1.5h.75V9H3a.75.75 0 010-1.5h.75v-.75a3 3 0 013-3h.75V3a.75.75 0 01.75-.75zM6 6.75A.75.75 0 016.75 6h10.5a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V6.75z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Google Gemini API
          </h2>
          <p className="text-sm text-muted">
            Powers the AI voice on phone calls
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Get your API key
          </h3>
          <ol className="space-y-3 text-sm text-muted">
            <SetupStep n={1}>
              Go to{" "}
              <span className="font-medium text-foreground">
                Google AI Studio
              </span>{" "}
              (aistudio.google.com)
            </SetupStep>
            <SetupStep n={2}>
              Click{" "}
              <span className="font-medium text-foreground">Get API Key</span>{" "}
              &rarr;{" "}
              <span className="font-medium text-foreground">
                Create API key
              </span>
            </SetupStep>
            <SetupStep n={3}>Copy the generated key</SetupStep>
          </ol>
        </div>

        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Add to your .env
          </h3>
          <div className="rounded-xl border border-card-border bg-sidebar-bg p-4 font-mono text-xs text-foreground">
            GEMINI_API_KEY=your_api_key_here
          </div>
          <p className="mt-2 text-xs text-muted">
            Then restart the bridge server for changes to take effect.
          </p>
        </div>

        <div className="rounded-xl border border-success/20 bg-success/5 p-4">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 shrink-0 text-success"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-success leading-relaxed">
              Gemini powers the real-time voice conversations on phone calls. The
              free tier is generous for development, but you&apos;ll want a paid plan
              for production use.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2: Google Calendar ─── */
function StepCalendar() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/15">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6 text-warning"
          >
            <path
              fillRule="evenodd"
              d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Google Calendar
          </h2>
          <p className="text-sm text-muted">
            Let your AI check availability and create events
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Create a Service Account
          </h3>
          <ol className="space-y-3 text-sm text-muted">
            <SetupStep n={1}>
              Go to the{" "}
              <span className="font-medium text-foreground">
                Google Cloud Console
              </span>{" "}
              (console.cloud.google.com)
            </SetupStep>
            <SetupStep n={2}>
              Create a project (or select an existing one)
            </SetupStep>
            <SetupStep n={3}>
              Enable the{" "}
              <span className="font-medium text-foreground">
                Google Calendar API
              </span>{" "}
              under APIs &amp; Services
            </SetupStep>
            <SetupStep n={4}>
              Go to{" "}
              <span className="font-medium text-foreground">
                IAM &amp; Admin &rarr; Service Accounts
              </span>{" "}
              and create a new service account
            </SetupStep>
            <SetupStep n={5}>
              Create a JSON key for the service account and download it
            </SetupStep>
            <SetupStep n={6}>
              Share your Google Calendar with the service account email (give it{" "}
              <span className="font-medium text-foreground">
                &quot;Make changes to events&quot;
              </span>{" "}
              permission)
            </SetupStep>
          </ol>
        </div>

        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Add to your .env
          </h3>
          <div className="rounded-xl border border-card-border bg-sidebar-bg p-4 font-mono text-xs text-foreground leading-relaxed">
            <div>
              GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
            </div>
            <div>GOOGLE_PRIVATE_KEY=&quot;-----BEGIN PRIVATE KEY-----\n...&quot;</div>
            <div>GOOGLE_CALENDAR_ID=primary</div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Copy the{" "}
            <code className="rounded bg-sidebar-bg px-1 py-0.5 font-mono text-accent-light">
              client_email
            </code>{" "}
            and{" "}
            <code className="rounded bg-sidebar-bg px-1 py-0.5 font-mono text-accent-light">
              private_key
            </code>{" "}
            from the downloaded JSON key file.
          </p>
        </div>

        <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 shrink-0 text-warning"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-warning leading-relaxed">
              Calendar integration is optional. You can skip this step and set it
              up later from the Integrations page. Your AI will still be able to
              make calls and join meetings without it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared step component ─── */
function SetupStep({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

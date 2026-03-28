"use client";

import { useEffect, useState } from "react";
import StatusCard from "@/components/StatusCard";
import ActiveCalls from "@/components/ActiveCalls";

interface BridgeStatus {
  activeCalls: number;
  uptime: number;
  configuredServices: {
    twilio: boolean;
    gemini: boolean;
  };
}

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

export default function Home() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [online, setOnline] = useState(false);

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

    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, []);

  const twilioReady = status?.configuredServices.twilio ?? false;
  const geminiReady = status?.configuredServices.gemini ?? false;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Hero */}
      <section className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Voisli
        </h1>
        <p className="mt-2 text-lg text-muted">Your AI Voice Assistant</p>
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

      {/* Quick Setup */}
      {(!twilioReady || !geminiReady) && (
        <section className="mb-8 rounded-xl border border-card-border bg-card p-6">
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
      <section className="rounded-xl border border-card-border bg-card p-6">
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

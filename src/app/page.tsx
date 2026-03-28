"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

export default function Home() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [online, setOnline] = useState(false);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [callLoading, setCallLoading] = useState(false);
  const [callResult, setCallResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

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
    fetchCalls();
    const id = setInterval(() => {
      fetchStatus();
      fetchCalls();
    }, 5000);
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
          toNumber: "+46737869515",
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
          status={!online ? "unknown" : twilioReady ? "online" : "offline"}
        />
        <StatusCard
          label="Gemini"
          status={!online ? "unknown" : geminiReady ? "online" : "offline"}
        />
      </section>

      {/* Active Calls */}
      <section className="mb-8">
        <ActiveCalls calls={[]} />
      </section>

      {/* Make a Test Call */}
      <section className="mb-8 rounded-xl border border-card-border bg-card p-6">
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
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {callLoading ? "Calling..." : "Place Test Call"}
          </button>
        </div>
        {callResult && (
          <p
            className={`mt-3 text-sm ${callResult.success ? "text-success" : "text-danger"}`}
          >
            {callResult.message}
          </p>
        )}
      </section>

      {/* Recent Call Activity */}
      <section className="mb-8 rounded-xl border border-card-border bg-card">
        <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
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
            <p className="text-sm text-muted">No recent calls</p>
          </div>
        ) : (
          <ul className="divide-y divide-card-border">
            {recentCalls.map((call) => (
              <li
                key={call.id}
                className="flex items-center justify-between px-5 py-3"
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
                    <p className="text-sm font-medium text-foreground capitalize">
                      {call.direction}
                    </p>
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
                        ? "text-yellow-400"
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
        <section className="mb-8 rounded-xl border border-card-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Quick Setup</h2>
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

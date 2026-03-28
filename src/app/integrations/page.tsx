"use client";

import { useState } from "react";

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_SERVER_URL || "http://localhost:8080";

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

const TOOLS = [
  {
    name: "initiate_call",
    description:
      "Initiate a phone call through Voisli for a caller-supplied session ID.",
    inputs: [
      { name: "phone_number", type: "string", required: true, desc: "Phone number to call (E.164 format)" },
      { name: "session_id", type: "string", required: true, desc: "Stable session identifier used across the runtime" },
    ],
  },
  {
    name: "join_meeting",
    description:
      "Send the Voisli bot to join a video meeting for a caller-supplied session ID.",
    inputs: [
      { name: "meeting_url", type: "string", required: true, desc: "Full meeting URL" },
      { name: "session_id", type: "string", required: true, desc: "Stable session identifier used across the runtime" },
    ],
  },
];

const RESOURCES = [
  {
    uri: "voisli://status",
    name: "Server Status",
    description: "Read-only voice runtime status and service health snapshot.",
  },
  {
    uri: "voisli://calls/active",
    name: "Active Calls",
    description: "Currently active phone calls with details.",
  },
  {
    uri: "voisli://calls/recent",
    name: "Recent Calls",
    description: "Last 10 calls with metadata and outcomes.",
  },
  {
    uri: "voisli://meetings/active",
    name: "Active Meetings",
    description: "Currently active meeting sessions.",
  },
  {
    uri: "voisli://meetings/recent",
    name: "Recent Meetings",
    description: "Recent meetings with summaries.",
  },
];

export default function IntegrationsPage() {
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${BRIDGE_URL}/status`);
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: true,
          message: `Bridge server is online — ${data.activeCalls ?? 0} active call(s), uptime ${data.uptime ?? 0}s`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Bridge server returned status ${res.status}`,
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Could not reach bridge server. Make sure it is running on " + BRIDGE_URL,
      });
    } finally {
      setTesting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(MCP_CONFIG).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <section className="mb-10 animate-fade-in">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Integrations
        </h1>
        <p className="mt-2 text-lg text-muted">
          Connect Voisli to Claude and other MCP-compatible AI agents
        </p>
      </section>

      {/* MCP Setup */}
      <section className="mb-8 glass-card rounded-xl p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
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
          <h2 className="text-lg font-semibold text-foreground">
            MCP Server Setup
          </h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Voisli exposes its capabilities through the{" "}
          <span className="text-foreground font-medium">Model Context Protocol (MCP)</span>.
          Add the following configuration to your Claude Desktop or Claude Code settings to
          register Voisli as an MCP server.
        </p>

        <ol className="mb-5 space-y-3 text-sm text-muted">
          <Step n={1} text="Make sure the Voisli bridge server is running (npm run dev:server)" />
          <Step n={2} text="Copy the JSON configuration below" />
          <Step
            n={3}
            text="For Claude Desktop: paste into Settings > Developer > MCP Servers config"
          />
          <Step
            n={4}
            text="For Claude Code: add to your .claude/settings.json or project .mcp.json"
          />
          <Step n={5} text="Update the cwd path to your local Voisli project directory" />
        </ol>

        {/* Config Snippet */}
        <div className="relative">
          <button
            onClick={handleCopy}
            className="absolute right-3 top-3 rounded-md bg-card-border/50 px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <pre className="overflow-x-auto rounded-lg border border-card-border bg-background p-4 font-mono text-xs text-foreground leading-relaxed">
            {MCP_CONFIG}
          </pre>
        </div>
      </section>

      {/* Test Connection */}
      <section className="mb-8 glass-card rounded-xl p-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Test Connection
            </h2>
            <p className="mt-1 text-sm text-muted">
              Verify the voice runtime is reachable from the MCP server
            </p>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-light hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>
        {testResult && (
          <p
            className={`mt-3 text-sm animate-fade-in ${testResult.success ? "text-success" : "text-danger"}`}
          >
            {testResult.message}
          </p>
        )}
      </section>

      {/* Available Tools */}
      <section className="mb-8 glass-card rounded-xl animate-fade-in">
        <div className="border-b border-card-border/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 text-success"
              >
                <path
                  fillRule="evenodd"
                  d="M12 6.75a5.25 5.25 0 016.775-5.025.75.75 0 01.313 1.248l-3.32 3.319c.063.475.276.934.641 1.299.365.365.824.578 1.3.641l3.318-3.319a.75.75 0 011.248.313 5.25 5.25 0 01-5.472 6.756c-1.018-.086-1.87.1-2.309.634L7.344 21.3A3.298 3.298 0 112.7 16.657l8.684-7.151c.533-.44.72-1.291.634-2.309A5.342 5.342 0 0112 6.75zM4.117 19.125a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-.008z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Available Tools
              </h2>
              <p className="text-sm text-muted">
                {TOOLS.length} tools an AI agent can invoke
              </p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-card-border/50">
          {TOOLS.map((tool, i) => (
            <div
              key={tool.name}
              className="px-5 py-4 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start gap-3">
                <code className="shrink-0 rounded bg-background px-2 py-0.5 font-mono text-xs text-accent-light">
                  {tool.name}
                </code>
                <p className="text-sm text-muted">{tool.description}</p>
              </div>
              <div className="mt-3 ml-0 flex flex-wrap gap-2">
                {tool.inputs.map((input) => (
                  <span
                    key={input.name}
                    className="inline-flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-xs"
                    title={input.desc}
                  >
                    <code className="font-mono text-foreground">{input.name}</code>
                    <span className="text-muted/60">{input.type}</span>
                    {!input.required && (
                      <span className="text-muted/40 italic">optional</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Available Resources */}
      <section className="mb-8 glass-card rounded-xl animate-fade-in">
        <div className="border-b border-card-border/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 text-accent-light"
              >
                <path d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875z" />
                <path d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 001.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 001.897 1.384C6.809 12.164 9.315 12.75 12 12.75z" />
                <path d="M12 18.375c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 001.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 001.897 1.384C6.809 17.789 9.315 18.375 12 18.375z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Available Resources
              </h2>
              <p className="text-sm text-muted">
                {RESOURCES.length} resources for querying Voisli state
              </p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-card-border/50">
          {RESOURCES.map((resource, i) => (
            <div
              key={resource.uri}
              className="flex items-start gap-3 px-5 py-4 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <code className="shrink-0 rounded bg-background px-2 py-0.5 font-mono text-xs text-accent-light">
                {resource.uri}
              </code>
              <p className="text-sm text-muted">{resource.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
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

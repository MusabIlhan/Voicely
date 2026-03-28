import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BridgeAPIFn } from "./bridge.js";

export function registerResources(server: McpServer, callBridgeAPI: BridgeAPIFn): void {
  // ── voisli://status ────────────────────────────────────────────────
  server.registerResource(
    "status",
    "voisli://status",
    {
      description:
        "Bridge server status — active calls, active meetings, uptime, and configured services.",
    },
    async () => {
      const res = await callBridgeAPI("GET", "/status");
      return {
        contents: [
          {
            uri: "voisli://status",
            mimeType: "application/json",
            text: JSON.stringify(res.data, null, 2),
          },
        ],
      };
    }
  );

  // ── voisli://calls/active ──────────────────────────────────────────
  server.registerResource(
    "active-calls",
    "voisli://calls/active",
    {
      description: "Currently active phone calls with details.",
    },
    async () => {
      const res = await callBridgeAPI<{ calls?: Array<Record<string, unknown>> }>(
        "GET",
        "/calls"
      );
      const allCalls = res.data?.calls ?? [];
      const active = allCalls.filter(
        (c) => c.status === "connecting" || c.status === "active"
      );
      return {
        contents: [
          {
            uri: "voisli://calls/active",
            mimeType: "application/json",
            text: JSON.stringify({ calls: active }, null, 2),
          },
        ],
      };
    }
  );

  // ── voisli://calls/recent ──────────────────────────────────────────
  server.registerResource(
    "recent-calls",
    "voisli://calls/recent",
    {
      description: "Last 10 calls with metadata and outcomes.",
    },
    async () => {
      const res = await callBridgeAPI<{ calls?: Array<Record<string, unknown>> }>(
        "GET",
        "/calls"
      );
      const allCalls = res.data?.calls ?? [];
      const recent = allCalls.slice(-10);
      return {
        contents: [
          {
            uri: "voisli://calls/recent",
            mimeType: "application/json",
            text: JSON.stringify({ calls: recent }, null, 2),
          },
        ],
      };
    }
  );

  // ── voisli://meetings/active ───────────────────────────────────────
  server.registerResource(
    "active-meetings",
    "voisli://meetings/active",
    {
      description: "Currently active meeting sessions.",
    },
    async () => {
      const res = await callBridgeAPI<{ sessions?: Array<Record<string, unknown>> }>(
        "GET",
        "/meetings"
      );
      const allSessions = res.data?.sessions ?? [];
      const active = allSessions.filter(
        (s) => s.status === "joining" || s.status === "in_call" || s.status === "creating"
      );
      return {
        contents: [
          {
            uri: "voisli://meetings/active",
            mimeType: "application/json",
            text: JSON.stringify({ meetings: active }, null, 2),
          },
        ],
      };
    }
  );

  // ── voisli://meetings/recent ───────────────────────────────────────
  server.registerResource(
    "recent-meetings",
    "voisli://meetings/recent",
    {
      description: "Recent meetings with summaries.",
    },
    async () => {
      const res = await callBridgeAPI<{ sessions?: Array<Record<string, unknown>> }>(
        "GET",
        "/meetings"
      );
      const allSessions = res.data?.sessions ?? [];
      const recent = allSessions.slice(-10);
      return {
        contents: [
          {
            uri: "voisli://meetings/recent",
            mimeType: "application/json",
            text: JSON.stringify({ meetings: recent }, null, 2),
          },
        ],
      };
    }
  );
}

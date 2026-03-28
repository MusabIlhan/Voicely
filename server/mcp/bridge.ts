/**
 * HTTP client for communicating with the Voisli bridge server.
 * The MCP server process is separate from the bridge server — this module
 * makes REST calls to the bridge server's API at the configured URL.
 */

import { config } from "../config.js";

const BRIDGE_SERVER_URL = config.bridgeServerUrl;

export interface BridgeResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export async function callBridgeAPI<T = unknown>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: Record<string, unknown>
): Promise<BridgeResponse<T>> {
  const url = `${BRIDGE_SERVER_URL}${path}`;

  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await res.json().catch(() => null)) as T;

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error connecting to bridge";
    return {
      ok: false,
      status: 0,
      data: {
        error: `Bridge server unreachable at ${BRIDGE_SERVER_URL}: ${message}`,
      } as T,
    };
  }
}

export function getBridgeServerUrl(): string {
  return BRIDGE_SERVER_URL;
}

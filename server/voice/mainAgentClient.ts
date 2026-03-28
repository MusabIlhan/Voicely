import { config } from "../config.js";
import type {
  AssistRequestPayload,
  AssistResponse,
  SessionEndPayload,
} from "./types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isPlainObject(value)) {
    throw new Error("Malformed /assist response: metadata must be an object");
  }

  return value;
}

export function parseAssistResponse(payload: unknown): AssistResponse {
  if (!isPlainObject(payload)) {
    throw new Error("Malformed /assist response: body must be an object");
  }

  if (typeof payload.turn_id !== "string" || payload.turn_id.trim().length === 0) {
    throw new Error("Malformed /assist response: turn_id must be a non-empty string");
  }

  if (typeof payload.say !== "string" || payload.say.trim().length === 0) {
    throw new Error("Malformed /assist response: say must be a non-empty string");
  }

  if (typeof payload.should_end_session !== "boolean") {
    throw new Error("Malformed /assist response: should_end_session must be a boolean");
  }

  return {
    turn_id: payload.turn_id,
    say: payload.say,
    should_end_session: payload.should_end_session,
    metadata: parseMetadata(payload.metadata),
  };
}

function withAuthHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${config.mainAgent.bearerToken}`,
    "Content-Type": "application/json",
  };
}

export class MainAgentClient {
  async requestAssist(payload: AssistRequestPayload, signal?: AbortSignal): Promise<AssistResponse> {
    const response = await fetch(config.mainAgent.assistUrl, {
      method: "POST",
      headers: withAuthHeaders(),
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Assist request failed with ${response.status}: ${body}`);
    }

    return parseAssistResponse(await response.json());
  }

  async sendSessionEnd(payload: SessionEndPayload): Promise<boolean> {
    const response = await fetch(config.mainAgent.sessionEndUrl, {
      method: "POST",
      headers: withAuthHeaders(),
      body: JSON.stringify(payload),
    });

    return response.status >= 200 && response.status < 300;
  }
}

export const mainAgentClient = new MainAgentClient();

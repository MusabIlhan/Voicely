import type { FunctionCall, FunctionResponse } from "@google/genai";
import { isConfigured } from "../config.js";
import {
  checkAvailability,
  createEvent,
  listUpcomingEvents,
} from "./handlers/calendar.js";
import { initiateOutboundCall } from "../twilio/outbound.js";
import { searchBusiness } from "./handlers/search.js";
import { meetingOrchestrator } from "../meeting/meetingOrchestrator.js";

/**
 * Handler function signature — takes parsed arguments, returns a result object.
 */
export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<Record<string, unknown>>;

/** Registry of tool name → handler function */
const handlers = new Map<string, ToolHandler>();

/**
 * Register a handler for a tool name.
 */
export function registerToolHandler(name: string, handler: ToolHandler): void {
  handlers.set(name, handler);
}

/**
 * Execute a single function call and return the FunctionResponse.
 */
async function executeSingle(fc: FunctionCall): Promise<FunctionResponse> {
  const name = fc.name ?? "unknown";
  const args = (fc.args as Record<string, unknown>) ?? {};

  const handler = handlers.get(name);
  if (!handler) {
    console.warn(`[ToolExecutor] No handler registered for tool: ${name}`);
    return {
      id: fc.id,
      name,
      response: { error: `Unknown tool: ${name}` },
    };
  }

  try {
    const result = await handler(args);
    return { id: fc.id, name, response: { output: result } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ToolExecutor] Error executing ${name}: ${message}`);
    return { id: fc.id, name, response: { error: message } };
  }
}

/**
 * Execute one or more function calls (handles parallel tool calls from Gemini).
 * Returns an array of FunctionResponse objects to send back.
 */
export async function executeToolCalls(
  functionCalls: FunctionCall[]
): Promise<FunctionResponse[]> {
  return Promise.all(functionCalls.map(executeSingle));
}

// ---------------------------------------------------------------------------
// Register tool handlers.
// Calendar tools use the real Google Calendar API when configured, otherwise
// they fall back to mock responses. Other tools are stubs for now.
// ---------------------------------------------------------------------------

registerToolHandler("check_calendar_availability", async (args) => {
  console.log("[ToolExecutor] check_calendar_availability called with:", args);
  if (!isConfigured().googleCalendar) {
    return {
      available: true,
      date: args.date,
      time_start: args.time_start,
      time_end: args.time_end,
      conflicts: [],
      message:
        "Google Calendar is not configured. Returning mock availability (free).",
    };
  }
  return checkAvailability(
    args.date as string,
    args.time_start as string,
    args.time_end as string
  );
});

registerToolHandler("create_calendar_event", async (args) => {
  console.log("[ToolExecutor] create_calendar_event called with:", args);
  if (!isConfigured().googleCalendar) {
    return {
      success: true,
      event_id: `evt_mock_${Date.now()}`,
      title: args.title,
      date: args.date,
      time_start: args.time_start,
      time_end: args.time_end,
      message: `Google Calendar is not configured. Mock event "${args.title}" created.`,
    };
  }
  return createEvent(
    args.title as string,
    args.date as string,
    args.time_start as string,
    args.time_end as string,
    args.description as string | undefined,
    args.location as string | undefined
  );
});

registerToolHandler("make_outbound_call", async (args) => {
  console.log("[ToolExecutor] make_outbound_call called with:", args);
  const result = await initiateOutboundCall(
    args.phone_number as string,
    args.purpose as string
  );
  return {
    success: result.success,
    call_sid: result.callSid,
    phone_number: result.toNumber,
    from_number: result.fromNumber,
    purpose: result.purpose,
    message: result.success
      ? `Outbound call initiated to ${result.toNumber}. Call SID: ${result.callSid}`
      : `Failed to initiate call: ${result.error}`,
    error: result.error,
  };
});

registerToolHandler("search_business", async (args) => {
  console.log("[ToolExecutor] search_business called with:", args);
  return searchBusiness(
    args.query as string,
    args.location as string | undefined
  ) as unknown as Record<string, unknown>;
});

registerToolHandler("end_call", async (args) => {
  console.log("[ToolExecutor] end_call called with:", args);
  return {
    success: true,
    reason: args.reason,
    message: "Call will be ended.",
  };
});

registerToolHandler("join_meeting", async (args) => {
  console.log("[ToolExecutor] join_meeting called with:", args);
  if (!isConfigured().recall) {
    return {
      success: false,
      error:
        "Recall.ai is not configured. Set RECALL_API_KEY in your .env file.",
    };
  }
  const session = await meetingOrchestrator.joinMeeting(
    args.meeting_url as string,
    args.bot_name as string | undefined
  );
  return {
    success: true,
    bot_id: session.botId,
    meeting_url: session.meetingUrl,
    status: session.status,
    message: `Voisli assistant is joining the meeting at ${session.meetingUrl}`,
  };
});

import type { FunctionCall, FunctionResponse } from "@google/genai";

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
// Register stub handlers for all tools.
// These will be replaced with real implementations in later phases.
// ---------------------------------------------------------------------------

registerToolHandler("check_calendar_availability", async (args) => {
  console.log("[ToolExecutor] check_calendar_availability called with:", args);
  // Stub: return a plausible mock response
  return {
    available: true,
    date: args.date,
    time_start: args.time_start,
    time_end: args.time_end,
    conflicts: [],
    message: "You are free during this time.",
  };
});

registerToolHandler("create_calendar_event", async (args) => {
  console.log("[ToolExecutor] create_calendar_event called with:", args);
  return {
    success: true,
    event_id: `evt_${Date.now()}`,
    title: args.title,
    date: args.date,
    time_start: args.time_start,
    time_end: args.time_end,
    message: `Event "${args.title}" created successfully.`,
  };
});

registerToolHandler("make_outbound_call", async (args) => {
  console.log("[ToolExecutor] make_outbound_call called with:", args);
  return {
    success: false,
    message:
      "Outbound calling is not yet configured. This will be implemented in a later phase.",
    phone_number: args.phone_number,
    purpose: args.purpose,
  };
});

registerToolHandler("search_business", async (args) => {
  console.log("[ToolExecutor] search_business called with:", args);
  return {
    results: [
      {
        name: "Bella Italia",
        phone: "+14155551234",
        rating: 4.5,
        cuisine: "Italian",
        address: "123 Main St",
      },
      {
        name: "Sakura Sushi",
        phone: "+14155555678",
        rating: 4.7,
        cuisine: "Japanese",
        address: "456 Oak Ave",
      },
      {
        name: "Le Petit Bistro",
        phone: "+14155559012",
        rating: 4.3,
        cuisine: "French",
        address: "789 Elm Blvd",
      },
    ],
    query: args.query,
    location: args.location ?? "nearby",
  };
});

registerToolHandler("end_call", async (args) => {
  console.log("[ToolExecutor] end_call called with:", args);
  return {
    success: true,
    reason: args.reason,
    message: "Call will be ended.",
  };
});

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callBridgeAPI } from "./bridge.js";

export function registerTools(server: McpServer): void {
  // ── make_call ──────────────────────────────────────────────────────
  server.registerTool(
    "make_call",
    {
      description:
        "Initiate a phone call through Voisli. The AI voice assistant will call the given number and follow the provided purpose/instructions.",
      inputSchema: {
        phone_number: z.string().describe("Phone number to call (E.164 format preferred, e.g. +15551234567)"),
        purpose: z.string().describe("Why you are calling — this guides the AI assistant's conversation"),
        instructions: z.string().optional().describe("Additional instructions for how the AI should behave on the call"),
      },
    },
    async ({ phone_number, purpose, instructions }) => {
      const body: Record<string, unknown> = { toNumber: phone_number, purpose };
      if (instructions) body.instructions = instructions;

      const res = await callBridgeAPI("POST", "/calls/outbound", body);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }] };
    }
  );

  // ── join_meeting ───────────────────────────────────────────────────
  server.registerTool(
    "join_meeting",
    {
      description:
        "Send the Voisli bot to join a video meeting (Zoom, Google Meet, Teams, etc.). The bot will listen, transcribe, and can answer questions.",
      inputSchema: {
        meeting_url: z.string().describe("Full meeting URL (e.g. https://zoom.us/j/123456)"),
        bot_name: z.string().optional().describe("Display name for the bot in the meeting (default: Voisli)"),
      },
    },
    async ({ meeting_url, bot_name }) => {
      const body: Record<string, unknown> = { meetingUrl: meeting_url };
      if (bot_name) body.botName = bot_name;

      const res = await callBridgeAPI("POST", "/meetings/join", body);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }] };
    }
  );

  // ── leave_meeting ──────────────────────────────────────────────────
  server.registerTool(
    "leave_meeting",
    {
      description: "Remove the Voisli bot from a meeting.",
      inputSchema: {
        bot_id: z.string().describe("The bot ID returned when the bot joined the meeting"),
      },
    },
    async ({ bot_id }) => {
      const res = await callBridgeAPI("POST", `/meetings/${encodeURIComponent(bot_id)}/leave`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  // ── check_calendar ─────────────────────────────────────────────────
  server.registerTool(
    "check_calendar",
    {
      description:
        "Check calendar availability for a given date and optional time range. Returns availability info and any conflicting events.",
      inputSchema: {
        date: z.string().describe("Date to check (YYYY-MM-DD)"),
        time_start: z.string().optional().describe("Start of time range (HH:MM, 24-hour)"),
        time_end: z.string().optional().describe("End of time range (HH:MM, 24-hour)"),
      },
    },
    async ({ date, time_start, time_end }) => {
      const params = new URLSearchParams({ date });
      if (time_start) params.set("time_start", time_start);
      if (time_end) params.set("time_end", time_end);

      const res = await callBridgeAPI("GET", `/calendar/availability?${params}`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }] };
    }
  );

  // ── create_calendar_event ──────────────────────────────────────────
  server.registerTool(
    "create_calendar_event",
    {
      description: "Create a new calendar event.",
      inputSchema: {
        title: z.string().describe("Event title"),
        date: z.string().describe("Event date (YYYY-MM-DD)"),
        time_start: z.string().describe("Start time (HH:MM, 24-hour)"),
        time_end: z.string().describe("End time (HH:MM, 24-hour)"),
        description: z.string().optional().describe("Event description"),
        location: z.string().optional().describe("Event location"),
      },
    },
    async ({ title, date, time_start, time_end, description, location }) => {
      const body: Record<string, unknown> = { title, date, time_start, time_end };
      if (description) body.description = description;
      if (location) body.location = location;

      const res = await callBridgeAPI("POST", "/calendar/events", body);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }] };
    }
  );

  // ── get_call_status ────────────────────────────────────────────────
  server.registerTool(
    "get_call_status",
    {
      description:
        "Check the status of an ongoing or recent phone call. Returns call details including status, duration, and any tool calls made.",
      inputSchema: {
        call_sid: z.string().describe("The call SID returned when the call was initiated"),
      },
    },
    async ({ call_sid }) => {
      const res = await callBridgeAPI("GET", `/calls/${encodeURIComponent(call_sid)}`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }] };
    }
  );

  // ── get_meeting_summary ────────────────────────────────────────────
  server.registerTool(
    "get_meeting_summary",
    {
      description:
        "Get an AI-generated summary of a meeting. Returns the summary, transcript highlights, and action items.",
      inputSchema: {
        bot_id: z.string().describe("The bot ID returned when the bot joined the meeting"),
      },
    },
    async ({ bot_id }) => {
      const res = await callBridgeAPI("GET", `/meetings/${encodeURIComponent(bot_id)}/summary`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }] };
    }
  );

  // ── get_meeting_transcript ─────────────────────────────────────────
  server.registerTool(
    "get_meeting_transcript",
    {
      description:
        "Get the full speaker-attributed transcript of a meeting.",
      inputSchema: {
        bot_id: z.string().describe("The bot ID returned when the bot joined the meeting"),
      },
    },
    async ({ bot_id }) => {
      const res = await callBridgeAPI("GET", `/meetings/${encodeURIComponent(bot_id)}/transcript`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }] };
    }
  );
}

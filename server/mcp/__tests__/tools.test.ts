import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools.js";

// Mock the bridge module
vi.mock("../bridge.js", () => ({
  callBridgeAPI: vi.fn(),
}));

import { callBridgeAPI } from "../bridge.js";
const mockCallBridgeAPI = vi.mocked(callBridgeAPI);

// Capture tools registered by registerTools
type RegisteredTool = {
  name: string;
  config: { description: string; inputSchema: Record<string, unknown> };
  callback: (args: Record<string, unknown>) => Promise<unknown>;
};

function captureTools(): RegisteredTool[] {
  const entries: RegisteredTool[] = [];
  const server = {
    registerTool: vi.fn(
      (
        name: string,
        config: { description: string; inputSchema: Record<string, unknown> },
        cb: (args: Record<string, unknown>) => Promise<unknown>
      ) => {
        entries.push({ name, config, callback: cb });
      }
    ),
  } as unknown as McpServer;

  registerTools(server);
  return entries;
}

type ToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

function getTool(tools: RegisteredTool[], name: string): RegisteredTool {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not registered`);
  return tool;
}

// ── Registration ───────────────────────────────────────────────────────

describe("registerTools", () => {
  let tools: RegisteredTool[];

  beforeEach(() => {
    vi.clearAllMocks();
    tools = captureTools();
  });

  it("registers exactly 8 tools", () => {
    expect(tools).toHaveLength(8);
  });

  it("registers all expected tool names", () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain("make_call");
    expect(names).toContain("join_meeting");
    expect(names).toContain("leave_meeting");
    expect(names).toContain("check_calendar");
    expect(names).toContain("create_calendar_event");
    expect(names).toContain("get_call_status");
    expect(names).toContain("get_meeting_summary");
    expect(names).toContain("get_meeting_transcript");
  });

  it("every tool has a description", () => {
    for (const tool of tools) {
      expect(tool.config.description).toBeTruthy();
      expect(typeof tool.config.description).toBe("string");
    }
  });
});

// ── make_call ──────────────────────────────────────────────────────────

describe("make_call tool", () => {
  let tools: RegisteredTool[];

  beforeEach(() => {
    vi.clearAllMocks();
    tools = captureTools();
  });

  it("sends correct request to POST /calls/outbound", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { callSid: "CA123", status: "queued" },
    });

    const tool = getTool(tools, "make_call");
    const result = (await tool.callback({
      phone_number: "+15551234567",
      purpose: "Make a reservation",
    })) as ToolResult;

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("POST", "/calls/outbound", {
      toNumber: "+15551234567",
      purpose: "Make a reservation",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.callSid).toBe("CA123");
  });

  it("includes optional instructions in request body", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { callSid: "CA456" },
    });

    const tool = getTool(tools, "make_call");
    await tool.callback({
      phone_number: "+15559876543",
      purpose: "Book appointment",
      instructions: "Be polite and confirm the date",
    });

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("POST", "/calls/outbound", {
      toNumber: "+15559876543",
      purpose: "Book appointment",
      instructions: "Be polite and confirm the date",
    });
  });

  it("returns isError when bridge responds with error", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 500,
      data: { error: "Internal server error" },
    });

    const tool = getTool(tools, "make_call");
    const result = (await tool.callback({
      phone_number: "+15551234567",
      purpose: "Test",
    })) as ToolResult;

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("Internal server error");
  });

  it("handles bridge unreachable gracefully", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 0,
      data: { error: "Bridge server unreachable at http://localhost:8080: ECONNREFUSED" },
    });

    const tool = getTool(tools, "make_call");
    const result = (await tool.callback({
      phone_number: "+15551234567",
      purpose: "Test",
    })) as ToolResult;

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("unreachable");
  });
});

// ── join_meeting ───────────────────────────────────────────────────────

describe("join_meeting tool", () => {
  let tools: RegisteredTool[];

  beforeEach(() => {
    vi.clearAllMocks();
    tools = captureTools();
  });

  it("sends correct request to POST /meetings/join", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { botId: "B1", status: "joining" },
    });

    const tool = getTool(tools, "join_meeting");
    const result = (await tool.callback({
      meeting_url: "https://zoom.us/j/123456",
    })) as ToolResult;

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("POST", "/meetings/join", {
      meetingUrl: "https://zoom.us/j/123456",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.botId).toBe("B1");
  });

  it("includes optional bot_name in request body", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { botId: "B2" },
    });

    const tool = getTool(tools, "join_meeting");
    await tool.callback({
      meeting_url: "https://meet.google.com/abc-def-ghi",
      bot_name: "Meeting Scribe",
    });

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("POST", "/meetings/join", {
      meetingUrl: "https://meet.google.com/abc-def-ghi",
      botName: "Meeting Scribe",
    });
  });

  it("returns isError on bridge failure", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 400,
      data: { error: "Invalid meeting URL" },
    });

    const tool = getTool(tools, "join_meeting");
    const result = (await tool.callback({
      meeting_url: "not-a-url",
    })) as ToolResult;

    expect(result.isError).toBe(true);
  });
});

// ── leave_meeting ──────────────────────────────────────────────────────

describe("leave_meeting tool", () => {
  let tools: RegisteredTool[];

  beforeEach(() => {
    vi.clearAllMocks();
    tools = captureTools();
  });

  it("sends correct request to POST /meetings/:botId/leave", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { success: true },
    });

    const tool = getTool(tools, "leave_meeting");
    const result = (await tool.callback({ bot_id: "B1" })) as ToolResult;

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("POST", "/meetings/B1/leave");
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
  });

  it("encodes bot_id in URL path", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {},
    });

    const tool = getTool(tools, "leave_meeting");
    await tool.callback({ bot_id: "bot/special id" });

    expect(mockCallBridgeAPI).toHaveBeenCalledWith(
      "POST",
      "/meetings/bot%2Fspecial%20id/leave"
    );
  });

  it("returns isError on bridge failure", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 404,
      data: { error: "Bot not found" },
    });

    const tool = getTool(tools, "leave_meeting");
    const result = (await tool.callback({ bot_id: "B999" })) as ToolResult;

    expect(result.isError).toBe(true);
  });
});

// ── check_calendar ─────────────────────────────────────────────────────

describe("check_calendar tool", () => {
  let tools: RegisteredTool[];

  beforeEach(() => {
    vi.clearAllMocks();
    tools = captureTools();
  });

  it("sends GET request with date query param", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { available: true, events: [] },
    });

    const tool = getTool(tools, "check_calendar");
    const result = (await tool.callback({
      date: "2026-03-28",
    })) as ToolResult;

    expect(mockCallBridgeAPI).toHaveBeenCalledWith(
      "GET",
      "/calendar/availability?date=2026-03-28"
    );
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.available).toBe(true);
  });

  it("includes time range params when provided", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { available: false, events: [{ title: "Meeting" }] },
    });

    const tool = getTool(tools, "check_calendar");
    await tool.callback({
      date: "2026-03-28",
      time_start: "09:00",
      time_end: "10:00",
    });

    expect(mockCallBridgeAPI).toHaveBeenCalledWith(
      "GET",
      "/calendar/availability?date=2026-03-28&time_start=09%3A00&time_end=10%3A00"
    );
  });

  it("returns isError on bridge failure", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 500,
      data: { error: "Calendar service unavailable" },
    });

    const tool = getTool(tools, "check_calendar");
    const result = (await tool.callback({
      date: "2026-03-28",
    })) as ToolResult;

    expect(result.isError).toBe(true);
  });
});

// ── create_calendar_event ──────────────────────────────────────────────

describe("create_calendar_event tool", () => {
  let tools: RegisteredTool[];

  beforeEach(() => {
    vi.clearAllMocks();
    tools = captureTools();
  });

  it("sends correct request to POST /calendar/events", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 201,
      data: { eventId: "E1", link: "https://calendar.google.com/event/E1" },
    });

    const tool = getTool(tools, "create_calendar_event");
    const result = (await tool.callback({
      title: "Team Standup",
      date: "2026-03-29",
      time_start: "09:00",
      time_end: "09:30",
    })) as ToolResult;

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("POST", "/calendar/events", {
      title: "Team Standup",
      date: "2026-03-29",
      time_start: "09:00",
      time_end: "09:30",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.eventId).toBe("E1");
  });

  it("includes optional description and location", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 201,
      data: { eventId: "E2" },
    });

    const tool = getTool(tools, "create_calendar_event");
    await tool.callback({
      title: "Lunch",
      date: "2026-03-29",
      time_start: "12:00",
      time_end: "13:00",
      description: "Weekly team lunch",
      location: "Conference Room B",
    });

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("POST", "/calendar/events", {
      title: "Lunch",
      date: "2026-03-29",
      time_start: "12:00",
      time_end: "13:00",
      description: "Weekly team lunch",
      location: "Conference Room B",
    });
  });

  it("returns isError on bridge failure", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 400,
      data: { error: "Invalid time range" },
    });

    const tool = getTool(tools, "create_calendar_event");
    const result = (await tool.callback({
      title: "Test",
      date: "2026-03-29",
      time_start: "15:00",
      time_end: "14:00",
    })) as ToolResult;

    expect(result.isError).toBe(true);
  });
});

// ── get_call_status ────────────────────────────────────────────────────

describe("get_call_status tool", () => {
  let tools: RegisteredTool[];

  beforeEach(() => {
    vi.clearAllMocks();
    tools = captureTools();
  });

  it("sends GET request to /calls/:callSid", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { callSid: "CA123", status: "in-progress", duration: 120 },
    });

    const tool = getTool(tools, "get_call_status");
    const result = (await tool.callback({
      call_sid: "CA123",
    })) as ToolResult;

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("GET", "/calls/CA123");
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("in-progress");
    expect(parsed.duration).toBe(120);
  });

  it("encodes call_sid in URL path", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {},
    });

    const tool = getTool(tools, "get_call_status");
    await tool.callback({ call_sid: "CA/special" });

    expect(mockCallBridgeAPI).toHaveBeenCalledWith(
      "GET",
      "/calls/CA%2Fspecial"
    );
  });

  it("returns isError when call not found", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 404,
      data: { error: "Call not found" },
    });

    const tool = getTool(tools, "get_call_status");
    const result = (await tool.callback({
      call_sid: "CA_NONEXISTENT",
    })) as ToolResult;

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("Call not found");
  });

  it("handles bridge unreachable gracefully", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 0,
      data: { error: "Bridge server unreachable at http://localhost:8080: ECONNREFUSED" },
    });

    const tool = getTool(tools, "get_call_status");
    const result = (await tool.callback({
      call_sid: "CA123",
    })) as ToolResult;

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("unreachable");
  });
});

// ── get_meeting_summary ────────────────────────────────────────────────

describe("get_meeting_summary tool", () => {
  let tools: RegisteredTool[];

  beforeEach(() => {
    vi.clearAllMocks();
    tools = captureTools();
  });

  it("sends GET request to /meetings/:botId/summary", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        summary: "Discussed Q2 roadmap",
        highlights: ["Budget approved"],
        actionItems: ["Follow up with design"],
      },
    });

    const tool = getTool(tools, "get_meeting_summary");
    const result = (await tool.callback({ bot_id: "B1" })) as ToolResult;

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("GET", "/meetings/B1/summary");
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.summary).toBe("Discussed Q2 roadmap");
    expect(parsed.actionItems).toContain("Follow up with design");
  });

  it("encodes bot_id in URL path", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {},
    });

    const tool = getTool(tools, "get_meeting_summary");
    await tool.callback({ bot_id: "bot/special" });

    expect(mockCallBridgeAPI).toHaveBeenCalledWith(
      "GET",
      "/meetings/bot%2Fspecial/summary"
    );
  });

  it("returns isError on bridge failure", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 404,
      data: { error: "Meeting not found" },
    });

    const tool = getTool(tools, "get_meeting_summary");
    const result = (await tool.callback({ bot_id: "B999" })) as ToolResult;

    expect(result.isError).toBe(true);
  });
});

// ── get_meeting_transcript ─────────────────────────────────────────────

describe("get_meeting_transcript tool", () => {
  let tools: RegisteredTool[];

  beforeEach(() => {
    vi.clearAllMocks();
    tools = captureTools();
  });

  it("sends GET request to /meetings/:botId/transcript", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        transcript: [
          { speaker: "Alice", text: "Let's begin" },
          { speaker: "Bob", text: "Sounds good" },
        ],
      },
    });

    const tool = getTool(tools, "get_meeting_transcript");
    const result = (await tool.callback({ bot_id: "B1" })) as ToolResult;

    expect(mockCallBridgeAPI).toHaveBeenCalledWith(
      "GET",
      "/meetings/B1/transcript"
    );
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.transcript).toHaveLength(2);
    expect(parsed.transcript[0].speaker).toBe("Alice");
  });

  it("encodes bot_id in URL path", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {},
    });

    const tool = getTool(tools, "get_meeting_transcript");
    await tool.callback({ bot_id: "bot/special" });

    expect(mockCallBridgeAPI).toHaveBeenCalledWith(
      "GET",
      "/meetings/bot%2Fspecial/transcript"
    );
  });

  it("returns isError on bridge failure", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 500,
      data: { error: "Transcription failed" },
    });

    const tool = getTool(tools, "get_meeting_transcript");
    const result = (await tool.callback({ bot_id: "B1" })) as ToolResult;

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("Transcription failed");
  });

  it("handles bridge unreachable gracefully", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 0,
      data: { error: "Bridge server unreachable at http://localhost:8080: ECONNREFUSED" },
    });

    const tool = getTool(tools, "get_meeting_transcript");
    const result = (await tool.callback({ bot_id: "B1" })) as ToolResult;

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("unreachable");
  });
});

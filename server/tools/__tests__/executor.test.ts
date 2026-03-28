import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FunctionCall } from "@google/genai";

// Mock dependencies before importing executor (handlers register at module load)
vi.mock("../../config.js", () => ({
  isConfigured: vi.fn(() => ({
    twilio: false,
    gemini: false,
    googleCalendar: false,
    recall: false,
  })),
  config: {
    twilio: { accountSid: "", authToken: "", phoneNumber: "" },
    gemini: { apiKey: "test-key" },
    googleCalendar: { serviceAccountEmail: "", privateKey: "", calendarId: "" },
    recall: { apiKey: "", apiBaseUrl: "https://us-west-2.recall.ai/api/v1" },
    server: { port: 8080, host: "localhost", publicUrl: "" },
    nextPublicBridgeServerUrl: "http://localhost:8080",
  },
}));

vi.mock("../handlers/calendar.js", () => ({
  checkAvailability: vi.fn(),
  createEvent: vi.fn(),
  listUpcomingEvents: vi.fn(),
}));

vi.mock("../../twilio/outbound.js", () => ({
  initiateOutboundCall: vi.fn(),
}));

vi.mock("../handlers/search.js", () => ({
  searchBusiness: vi.fn(() => ({
    results: [{ name: "Mock Bistro", phone: "+10000000000", rating: 4.0, cuisine: "Test", address: "1 Test St" }],
    query: "test",
    location: "nearby",
  })),
}));

vi.mock("../../meeting/meetingOrchestrator.js", () => ({
  meetingOrchestrator: {
    joinMeeting: vi.fn(async (meetingUrl: string, botName?: string) => ({
      botId: "bot_mock_123",
      meetingUrl,
      status: "creating",
      participants: [],
      startedAt: new Date(),
      contextWindow: [],
    })),
    leaveMeeting: vi.fn(),
    getSession: vi.fn(),
    getAllSessions: vi.fn(() => []),
    getTranscript: vi.fn(() => []),
    getSummary: vi.fn(() => ""),
  },
}));

import { executeToolCalls, registerToolHandler } from "../executor";
import { isConfigured } from "../../config.js";
import { checkAvailability, createEvent } from "../handlers/calendar.js";
import { initiateOutboundCall } from "../../twilio/outbound.js";

const mockedIsConfigured = vi.mocked(isConfigured);
const mockedCheckAvailability = vi.mocked(checkAvailability);
const mockedCreateEvent = vi.mocked(createEvent);
const mockedInitiateOutboundCall = vi.mocked(initiateOutboundCall);

beforeEach(() => {
  vi.clearAllMocks();
  mockedIsConfigured.mockReturnValue({
    twilio: false,
    gemini: false,
    googleCalendar: false,
    recall: false,
  });
});

describe("executeToolCalls — routing", () => {
  it("routes check_calendar_availability and returns mock when not configured", async () => {
    const calls: FunctionCall[] = [
      { id: "fc1", name: "check_calendar_availability", args: { date: "2026-04-01", time_start: "18:00", time_end: "19:00" } },
    ];

    const [result] = await executeToolCalls(calls);

    expect(result.name).toBe("check_calendar_availability");
    expect(result.id).toBe("fc1");
    const output = result.response as Record<string, unknown>;
    expect((output.output as Record<string, unknown>).available).toBe(true);
    expect((output.output as Record<string, unknown>).conflicts).toEqual([]);
  });

  it("routes check_calendar_availability to real handler when configured", async () => {
    mockedIsConfigured.mockReturnValue({ twilio: false, gemini: false, googleCalendar: true, recall: false });
    mockedCheckAvailability.mockResolvedValue({
      available: false,
      date: "2026-04-01",
      time_start: "18:00",
      time_end: "19:00",
      conflicts: [{ title: "Dinner" }],
      message: "You have a conflict.",
    });

    const calls: FunctionCall[] = [
      { id: "fc2", name: "check_calendar_availability", args: { date: "2026-04-01", time_start: "18:00", time_end: "19:00" } },
    ];

    const [result] = await executeToolCalls(calls);
    const output = (result.response as Record<string, unknown>).output as Record<string, unknown>;

    expect(mockedCheckAvailability).toHaveBeenCalledWith("2026-04-01", "18:00", "19:00");
    expect(output.available).toBe(false);
  });

  it("routes create_calendar_event and returns mock when not configured", async () => {
    const calls: FunctionCall[] = [
      {
        id: "fc3",
        name: "create_calendar_event",
        args: { title: "Dinner", date: "2026-04-01", time_start: "19:00", time_end: "20:00" },
      },
    ];

    const [result] = await executeToolCalls(calls);
    const output = (result.response as Record<string, unknown>).output as Record<string, unknown>;

    expect(result.name).toBe("create_calendar_event");
    expect(output.success).toBe(true);
    expect(output.title).toBe("Dinner");
    expect((output.event_id as string).startsWith("evt_mock_")).toBe(true);
  });

  it("routes create_calendar_event to real handler when configured", async () => {
    mockedIsConfigured.mockReturnValue({ twilio: false, gemini: false, googleCalendar: true, recall: false });
    mockedCreateEvent.mockResolvedValue({
      success: true,
      event_id: "evt_real_123",
      title: "Dinner",
      date: "2026-04-01",
      time_start: "19:00",
      time_end: "20:00",
      link: "https://calendar.google.com/event/123",
      message: "Event created.",
    });

    const calls: FunctionCall[] = [
      {
        id: "fc4",
        name: "create_calendar_event",
        args: { title: "Dinner", date: "2026-04-01", time_start: "19:00", time_end: "20:00" },
      },
    ];

    const [result] = await executeToolCalls(calls);
    const output = (result.response as Record<string, unknown>).output as Record<string, unknown>;

    expect(mockedCreateEvent).toHaveBeenCalledWith("Dinner", "2026-04-01", "19:00", "20:00", undefined, undefined);
    expect(output.event_id).toBe("evt_real_123");
  });

  it("routes make_outbound_call to Twilio handler", async () => {
    mockedInitiateOutboundCall.mockResolvedValue({
      success: true,
      callSid: "CA_test_123",
      toNumber: "+14155551234",
      fromNumber: "+18005551234",
      purpose: "Make a reservation",
    });

    const calls: FunctionCall[] = [
      { id: "fc5", name: "make_outbound_call", args: { phone_number: "+14155551234", purpose: "Make a reservation" } },
    ];

    const [result] = await executeToolCalls(calls);
    const output = (result.response as Record<string, unknown>).output as Record<string, unknown>;

    expect(mockedInitiateOutboundCall).toHaveBeenCalledWith("+14155551234", "Make a reservation");
    expect(output.success).toBe(true);
    expect(output.call_sid).toBe("CA_test_123");
    expect((output.message as string)).toContain("Outbound call initiated");
  });

  it("routes search_business to search handler", async () => {
    const calls: FunctionCall[] = [
      { id: "fc6", name: "search_business", args: { query: "test", location: "SF" } },
    ];

    const [result] = await executeToolCalls(calls);
    const output = (result.response as Record<string, unknown>).output as Record<string, unknown>;

    expect(result.name).toBe("search_business");
    expect(output).toHaveProperty("results");
  });

  it("routes end_call and returns success", async () => {
    const calls: FunctionCall[] = [
      { id: "fc7", name: "end_call", args: { reason: "User hung up" } },
    ];

    const [result] = await executeToolCalls(calls);
    const output = (result.response as Record<string, unknown>).output as Record<string, unknown>;

    expect(result.name).toBe("end_call");
    expect(output.success).toBe(true);
    expect(output.reason).toBe("User hung up");
    expect(output.message).toBe("Call will be ended.");
  });
});

describe("executeToolCalls — unknown tool", () => {
  it("returns an error response for an unregistered tool name", async () => {
    const calls: FunctionCall[] = [
      { id: "fc_unknown", name: "nonexistent_tool", args: {} },
    ];

    const [result] = await executeToolCalls(calls);

    expect(result.name).toBe("nonexistent_tool");
    expect(result.id).toBe("fc_unknown");
    const resp = result.response as Record<string, unknown>;
    expect(resp.error).toBe("Unknown tool: nonexistent_tool");
    expect(resp).not.toHaveProperty("output");
  });

  it("defaults name to 'unknown' when FunctionCall has no name", async () => {
    const calls: FunctionCall[] = [
      { id: "fc_noname", args: {} } as FunctionCall,
    ];

    const [result] = await executeToolCalls(calls);
    expect(result.name).toBe("unknown");
  });
});

describe("executeToolCalls — error handling", () => {
  it("catches handler errors and returns them in the response", async () => {
    mockedIsConfigured.mockReturnValue({ twilio: false, gemini: false, googleCalendar: true, recall: false });
    mockedCheckAvailability.mockRejectedValue(new Error("Google API rate limit exceeded"));

    const calls: FunctionCall[] = [
      { id: "fc_err", name: "check_calendar_availability", args: { date: "2026-04-01", time_start: "18:00", time_end: "19:00" } },
    ];

    const [result] = await executeToolCalls(calls);
    const resp = result.response as Record<string, unknown>;

    expect(resp.error).toBe("Google API rate limit exceeded");
    expect(resp).not.toHaveProperty("output");
  });

  it("handles non-Error thrown values", async () => {
    mockedIsConfigured.mockReturnValue({ twilio: false, gemini: false, googleCalendar: true, recall: false });
    mockedCheckAvailability.mockRejectedValue("raw string error");

    const calls: FunctionCall[] = [
      { id: "fc_raw", name: "check_calendar_availability", args: { date: "2026-04-01", time_start: "18:00", time_end: "19:00" } },
    ];

    const [result] = await executeToolCalls(calls);
    const resp = result.response as Record<string, unknown>;

    expect(resp.error).toBe("raw string error");
  });
});

describe("executeToolCalls — parallel execution", () => {
  it("executes multiple tool calls in parallel and returns all results", async () => {
    mockedInitiateOutboundCall.mockResolvedValue({
      success: true,
      callSid: "CA_parallel",
      toNumber: "+14155551234",
      fromNumber: "+18005551234",
      purpose: "test",
    });

    const calls: FunctionCall[] = [
      { id: "p1", name: "search_business", args: { query: "pizza" } },
      { id: "p2", name: "end_call", args: { reason: "done" } },
      { id: "p3", name: "make_outbound_call", args: { phone_number: "+14155551234", purpose: "test" } },
    ];

    const results = await executeToolCalls(calls);

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe("p1");
    expect(results[0].name).toBe("search_business");
    expect(results[1].id).toBe("p2");
    expect(results[1].name).toBe("end_call");
    expect(results[2].id).toBe("p3");
    expect(results[2].name).toBe("make_outbound_call");
  });

  it("returns individual errors without failing the batch", async () => {
    mockedIsConfigured.mockReturnValue({ twilio: false, gemini: false, googleCalendar: true, recall: false });
    mockedCheckAvailability.mockRejectedValue(new Error("API down"));

    const calls: FunctionCall[] = [
      { id: "b1", name: "check_calendar_availability", args: { date: "2026-04-01", time_start: "18:00", time_end: "19:00" } },
      { id: "b2", name: "end_call", args: { reason: "done" } },
    ];

    const results = await executeToolCalls(calls);

    expect(results).toHaveLength(2);
    // First call failed
    expect((results[0].response as Record<string, unknown>).error).toBe("API down");
    // Second call succeeded
    expect(((results[1].response as Record<string, unknown>).output as Record<string, unknown>).success).toBe(true);
  });
});

describe("executeToolCalls — join_meeting", () => {
  it("returns error when recall is not configured", async () => {
    mockedIsConfigured.mockReturnValue({ twilio: false, gemini: false, googleCalendar: false, recall: false });

    const calls: FunctionCall[] = [
      { id: "jm1", name: "join_meeting", args: { meeting_url: "https://meet.google.com/abc-defg-hij" } },
    ];

    const [result] = await executeToolCalls(calls);
    const output = (result.response as Record<string, unknown>).output as Record<string, unknown>;

    expect(result.name).toBe("join_meeting");
    expect(output.success).toBe(false);
    expect(output.error).toContain("Recall.ai is not configured");
  });

  it("routes to meeting orchestrator when recall is configured", async () => {
    mockedIsConfigured.mockReturnValue({ twilio: false, gemini: false, googleCalendar: false, recall: true });

    const calls: FunctionCall[] = [
      { id: "jm2", name: "join_meeting", args: { meeting_url: "https://meet.google.com/abc-defg-hij" } },
    ];

    const [result] = await executeToolCalls(calls);
    const output = (result.response as Record<string, unknown>).output as Record<string, unknown>;

    expect(result.name).toBe("join_meeting");
    expect(output.success).toBe(true);
    expect(output.bot_id).toBe("bot_mock_123");
    expect(output.meeting_url).toBe("https://meet.google.com/abc-defg-hij");
    expect((output.message as string)).toContain("joining the meeting");
  });
});

describe("registerToolHandler", () => {
  it("allows registering and executing a custom tool handler", async () => {
    registerToolHandler("custom_test_tool", async (args) => {
      return { echo: args.message, custom: true };
    });

    const calls: FunctionCall[] = [
      { id: "custom1", name: "custom_test_tool", args: { message: "hello" } },
    ];

    const [result] = await executeToolCalls(calls);
    const output = (result.response as Record<string, unknown>).output as Record<string, unknown>;

    expect(output.echo).toBe("hello");
    expect(output.custom).toBe(true);
  });
});

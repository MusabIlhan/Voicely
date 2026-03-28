import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools.js";
import type { BridgeAPIFn } from "../bridge.js";

const mockCallBridgeAPI = vi.fn() as unknown as BridgeAPIFn & ReturnType<typeof vi.fn>;

type RegisteredTool = {
  name: string;
  callback: (args: Record<string, unknown>) => Promise<unknown>;
};

function captureTools(): RegisteredTool[] {
  const tools: RegisteredTool[] = [];
  const server = {
    registerTool: vi.fn((name: string, _config: unknown, callback: RegisteredTool["callback"]) => {
      tools.push({ name, callback });
    }),
  } as unknown as McpServer;

  registerTools(server, mockCallBridgeAPI);
  return tools;
}

function getTool(tools: RegisteredTool[], name: string): RegisteredTool {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Missing tool ${name}`);
  }

  return tool;
}

describe("registerTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers only the active voice tools", () => {
    const tools = captureTools();
    expect(tools.map((tool) => tool.name)).toEqual(["initiate_call", "join_meeting"]);
  });

  it("initiate_call forwards phone_number and session_id", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: "dialling" },
    });

    const tools = captureTools();
    const result = await getTool(tools, "initiate_call").callback({
      phone_number: "+15551234567",
      session_id: "session-1",
    }) as { content: Array<{ text: string }> };

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("POST", "/calls/initiate", {
      phoneNumber: "+15551234567",
      sessionId: "session-1",
    });
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "dialling" });
  });

  it("join_meeting forwards meeting_url and session_id", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: "joining", bot_id: "bot-1" },
    });

    const tools = captureTools();
    const result = await getTool(tools, "join_meeting").callback({
      meeting_url: "https://meet.google.com/abc-defg-hij",
      session_id: "session-2",
    }) as { content: Array<{ text: string }> };

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("POST", "/meetings/join", {
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      sessionId: "session-2",
    });
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "joining", bot_id: "bot-1" });
  });
});

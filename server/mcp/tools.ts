import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callBridgeAPI, type BridgeAPIFn } from "./bridge.js";

export function registerTools(
  server: McpServer,
  bridgeClient: BridgeAPIFn = callBridgeAPI
): void {
  server.registerTool(
    "initiate_call",
    {
      description:
        "Initiate a phone call through Voicely for the supplied session.",
      inputSchema: {
        phone_number: z.string().describe("Phone number to call (E.164 format preferred, e.g. +15551234567)"),
        session_id: z.string().describe("Stable session identifier supplied by the caller"),
      },
    },
    async ({ phone_number, session_id }) => {
      const body = { phoneNumber: phone_number, sessionId: session_id };

      const res = await bridgeClient("POST", "/calls/initiate", body);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }] };
    }
  );

  server.registerTool(
    "join_meeting",
    {
      description:
        "Send the Voicely bot to join a video meeting for the supplied session.",
      inputSchema: {
        meeting_url: z.string().describe("Full meeting URL (e.g. https://zoom.us/j/123456)"),
        session_id: z.string().describe("Stable session identifier supplied by the caller"),
      },
    },
    async ({ meeting_url, session_id }) => {
      const body = { meetingUrl: meeting_url, sessionId: session_id };

      const res = await bridgeClient("POST", "/meetings/join", body);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data) }] };
    }
  );
}

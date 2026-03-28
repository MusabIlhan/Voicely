# Phase 04: MCP Server — Expose Voisli as a Tool for Claude & Other AI Agents

This phase turns Voisli into an MCP (Model Context Protocol) server, allowing Claude, and any other MCP-compatible AI agent, to invoke Voisli's capabilities as tools. An agent can say "call this restaurant and make a reservation" or "join this meeting and tell me what they discussed" — and Voisli executes it. This is the integration layer that makes Voisli composable with the broader AI ecosystem. The MCP server wraps around the existing bridge server functionality and exposes it through the standardized MCP protocol.

## Tasks

- [x] Set up the MCP server infrastructure:
  - Install the MCP TypeScript SDK: `@modelcontextprotocol/sdk`
  - Create `server/mcp/` directory for all MCP-related code
  - Create `server/mcp/index.ts` — the MCP server entry point:
    - Initialize an MCP server using the SDK's `Server` class
    - Configure server metadata: name "voisli", version from package.json, description "AI Voice Assistant — make calls, join meetings, manage calendar"
    - The MCP server should communicate over stdio (standard for MCP servers invoked by Claude Desktop, Claude Code, etc.)
    - Import and register all tools and resources (defined in subsequent files)
  - Add a new npm script to `package.json`:
    - `"mcp"` — runs the MCP server via `tsx server/mcp/index.ts`
  - Create `server/mcp/bridge.ts` — a client that connects to the running bridge server:
    - The MCP server process is separate from the bridge server process
    - This module makes HTTP calls to the bridge server's REST API (localhost:8080) to execute actions
    - `callBridgeAPI(method, path, body?)` — generic helper for making requests to the bridge server
    - Handles connection errors gracefully (if bridge server isn't running, return clear error to the agent)

- [x] Implement MCP tools that expose Voisli's voice and meeting capabilities:
  - Create `server/mcp/tools.ts` — register all MCP tools:
    - `make_call` — Initiate a phone call through Voisli
      - Input schema: `{ phone_number: string, purpose: string, instructions?: string }`
      - Calls `POST /calls/outbound` on the bridge server
      - Returns call SID and status
    - `join_meeting` — Send the Voisli bot to join a meeting
      - Input schema: `{ meeting_url: string, bot_name?: string }`
      - Calls `POST /meetings/join` on the bridge server
      - Returns bot ID and join status
    - `leave_meeting` — Remove the Voisli bot from a meeting
      - Input schema: `{ bot_id: string }`
      - Calls `POST /meetings/:botId/leave`
    - `check_calendar` — Check calendar availability
      - Input schema: `{ date: string, time_start?: string, time_end?: string }`
      - Calls the calendar handler directly or via a bridge API endpoint
      - Returns availability information and any conflicting events
    - `create_calendar_event` — Create a new calendar event
      - Input schema: `{ title: string, date: string, time_start: string, time_end: string, description?: string, location?: string }`
      - Returns event confirmation with ID and link
    - `get_call_status` — Check the status of an ongoing or recent call
      - Input schema: `{ call_sid: string }`
      - Returns call details including status, duration, and any tool calls made
    - `get_meeting_summary` — Get an AI-generated summary of a meeting
      - Input schema: `{ bot_id: string }`
      - Returns the meeting summary, transcript highlights, and action items
    - `get_meeting_transcript` — Get the full transcript of a meeting
      - Input schema: `{ bot_id: string }`
      - Returns speaker-attributed transcript
  - Each tool should have clear descriptions so the AI agent knows when and how to use them

- [x] Implement MCP resources for dynamic Voisli state:
  - Add to `server/mcp/tools.ts` or create `server/mcp/resources.ts`:
    - Resource `voisli://status` — returns the bridge server status (active calls, active meetings, configured services)
    - Resource `voisli://calls/active` — returns list of currently active calls with details
    - Resource `voisli://calls/recent` — returns last 10 calls with metadata and outcomes
    - Resource `voisli://meetings/active` — returns currently active meeting sessions
    - Resource `voisli://meetings/recent` — returns recent meetings with summaries
  - Resources should return structured JSON that an AI agent can reason about

- [x] Create the MCP server configuration file and test the setup:
  - Create a `mcp-config.json` example showing how to register Voisli with Claude Desktop or Claude Code:
    ```json
    {
      "mcpServers": {
        "voisli": {
          "command": "npx",
          "args": ["tsx", "server/mcp/index.ts"],
          "cwd": "/path/to/voisli",
          "env": {
            "BRIDGE_SERVER_URL": "http://localhost:8080"
          }
        }
      }
    }
    ```
  - Add `BRIDGE_SERVER_URL` to `.env.example` and `server/config.ts` for MCP server to locate the bridge server
  - Create `server/mcp/__tests__/tools.test.ts`:
    - Test each tool's input validation
    - Test that tools correctly format requests to the bridge server (with mocked HTTP)
    - Test error handling when bridge server is unreachable
  - Run the MCP server in test mode to verify it starts and lists all tools correctly

- [x] Add a dedicated MCP/integrations section to the Next.js dashboard and update documentation:
  - Search existing pages and components before creating new files — extend the existing navigation pattern
  - Create `src/app/integrations/page.tsx`:
    - Show MCP server setup instructions (how to add Voisli to Claude Desktop / Claude Code)
    - Display the JSON configuration snippet
    - List all available MCP tools with their descriptions and input schemas
    - List all available MCP resources
    - Show a "Test Connection" button that verifies the bridge server is reachable from the MCP server
  - Update the main dashboard to show an "Integrations" link in the navigation
  - Update the bridge server `GET /status` endpoint to include MCP-related info (whether MCP is configured)

- [ ] Run all tests across the project (tools, audio, meeting, MCP) and fix any failures. Verify:
  - The MCP server starts via `npm run mcp` and outputs its tool list
  - The bridge server still starts correctly with all endpoints
  - The Next.js dashboard builds and all pages render
  - All test suites pass

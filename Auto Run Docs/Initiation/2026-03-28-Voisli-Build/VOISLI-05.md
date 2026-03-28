# Phase 05: Dashboard Polish, Real-Time Updates & Demo Day Preparation

This is the final phase — polish the UI, add real-time updates so the dashboard feels alive during demos, and prepare everything for a smooth hackathon presentation. The dashboard should be visually impressive, responsive to live events (calls ringing, meetings in progress, tools being invoked), and the full demo flow should work end-to-end. This phase transforms a functional prototype into a demo-ready product.

## Tasks

- [x] Add real-time WebSocket updates to the Next.js dashboard so it reflects live activity without polling:
  - Search the existing `server/index.ts` and dashboard components to understand the current polling approach before making changes
  - Create `server/events.ts` — a server-sent events (SSE) or WebSocket endpoint for the dashboard:
    - Add a `GET /events` SSE endpoint to the Express bridge server
    - Emit events when: a call starts, a call ends, a tool is invoked during a call, a meeting bot joins, transcript updates arrive, a meeting bot speaks
    - Event format: `{ type: 'call_started' | 'call_ended' | 'tool_invoked' | 'meeting_joined' | 'transcript_update' | 'bot_spoke', data: {...} }`
  - Update `server/callOrchestrator.ts` and `server/meeting/meetingOrchestrator.ts` to emit events through this system
  - Create `src/hooks/useServerEvents.ts` — a React hook that connects to the SSE endpoint:
    - Maintains connection with automatic reconnection
    - Provides typed event callbacks
    - Returns connection status
  - Update all dashboard pages to use real-time events instead of polling:
    - `src/app/page.tsx` — live call count, live meeting count, activity feed with real-time entries
    - `src/app/calls/page.tsx` — calls appear/update in real-time
    - `src/app/meetings/[botId]/page.tsx` — transcript updates stream in live

- [x] Polish the dashboard UI for demo-day visual impact:
  - Search all existing components in `src/components/` and pages in `src/app/` to understand the current design before making changes
  - Enhance the main dashboard (`src/app/page.tsx`):
    - Add an animated activity feed showing real-time events with timestamps (call started, tool invoked, meeting joined, etc.)
    - Add subtle animations: status indicators pulse when active, cards fade in, numbers animate on change
    - Ensure the layout looks great on a projector (large fonts for key metrics, high contrast)
  - Enhance the calls page:
    - Show a live waveform or activity indicator when a call is active
    - Display tool call cards inline showing what the AI did (e.g., "Checked calendar → Available", "Created event → Dinner at 7pm")
  - Enhance the meetings page:
    - Live transcript with speaker colors and smooth scroll
    - Highlight moments when the bot spoke (different background color)
    - Show tool invocations inline in the transcript
  - Global styling improvements:
    - Consistent card design with subtle glass-morphism or clean borders
    - Smooth page transitions
    - Loading states and empty states that look intentional, not broken
    - Ensure all pages work well at 1920x1080 (common projector resolution)

- [x] Build a demo control panel for the hackathon presentation:
  - Create `src/app/demo/page.tsx` — a special page for running the demo:
    - **Demo Flow 1: Restaurant Reservation**
      - "Start Demo Call" button that shows the Twilio number to call (or initiates an outbound call to a test number)
      - Live display of what the AI is hearing and saying
      - Live display of tool calls as they happen (calendar check, reservation creation)
    - **Demo Flow 2: Meeting Assistant**
      - "Join Meeting" input with a Google Meet URL
      - Live transcript display
      - Indicator when the bot is speaking
      - "Ask the Bot" simulation (for if no one asks during the live demo)
    - **Demo Flow 3: MCP Integration**
      - Show the MCP tool list
      - Display a live log of MCP tool invocations if Claude calls them during the demo
      - Show the config snippet for adding to Claude
    - Each section has a status indicator (ready / in progress / completed)
    - All three flows visible on one scrollable page for easy presentation

- [ ] Create comprehensive error handling and graceful degradation:
  - Search all server files in `server/` for existing error handling patterns and extend them consistently
  - Update `server/index.ts` with a global error handler middleware
  - Ensure each external service failure (Twilio, Gemini, Recall.ai, Google Calendar) is caught and produces a user-friendly error:
    - On the dashboard: show clear error cards instead of blank states
    - In voice calls: Gemini should acknowledge the error vocally ("I'm sorry, I wasn't able to check your calendar right now")
    - In meetings: bot should not crash if one response fails
  - Add a health check endpoint `GET /health` that tests connectivity to all external services and reports their status
  - Update the dashboard status card to use the health endpoint

- [ ] End-to-end testing and demo flow verification:
  - Create `scripts/test-demo.sh` — a script that verifies all systems are ready:
    - Check that the bridge server is running and responds to `/health`
    - Check that all required environment variables are set
    - Check that the Next.js dashboard is accessible
    - Verify Twilio webhook URL is configured (check via Twilio API)
    - Print a summary of what's ready and what needs attention
  - Test each demo flow manually (document the expected steps):
    - Flow 1: Call Twilio number → talk to Voisli → ask to make a reservation → AI checks calendar → AI confirms
    - Flow 2: POST to /meetings/join with a test Meet URL → bot joins → verify transcript → ask bot a question → bot speaks
    - Flow 3: Run the MCP server → verify tool list → invoke a tool via MCP test client
  - Fix any issues discovered during testing
  - Verify all TypeScript compiles cleanly (`npm run build`)
  - Verify all test suites pass
  - Ensure `npm run dev` starts both servers cleanly and the dashboard renders all pages

# Phase 02: Gemini Tool Calling, Outbound Calls & Google Calendar Integration

This phase adds intelligence to the voice assistant. Gemini 3.1 Flash Live supports native function/tool calling from audio — meaning the AI can understand a spoken request like "book me a table at 7pm" and trigger a structured function call mid-conversation. This phase implements the tool calling framework, integrates Google Calendar for scheduling, adds outbound calling capability (so Voisli can call restaurants on your behalf), and wires up a complete reservation demo flow. By the end, you'll be able to call Voisli, ask it to make a reservation, and have it check your calendar and "call" the restaurant.

## Tasks

- [x] Implement the Gemini function calling / tool system. Search the existing `server/gemini/liveClient.ts` for how tool calls are currently handled (the `onToolCall` callback) and build on top of it:
  - Create `server/tools/schema.ts` — define all tool schemas in the format Gemini expects (FunctionDeclaration objects):
    - `check_calendar_availability` — params: date (string), time_start (string), time_end (string). Description: "Check if the user has availability on their calendar for a given date and time range"
    - `create_calendar_event` — params: title (string), date (string), time_start (string), time_end (string), description (string, optional), location (string, optional). Description: "Create a new event on the user's calendar"
    - `make_outbound_call` — params: phone_number (string), purpose (string). Description: "Initiate an outbound phone call to a business or person"
    - `search_business` — params: query (string), location (string, optional). Description: "Search for a business like a restaurant, salon, or service provider" (stub for now, returns mock results)
    - `end_call` — params: reason (string). Description: "End the current phone call politely"
  - Create `server/tools/executor.ts` — a tool execution dispatcher:
    - Takes a tool name and parsed arguments
    - Routes to the appropriate handler function
    - Returns the result object that gets sent back to Gemini as the function response
    - Handles errors gracefully (returns error message to Gemini so it can communicate the failure to the user)
  - Update `server/gemini/liveClient.ts` to:
    - Pass the tool schemas when configuring the Gemini Live session (in the tools/function_declarations config)
    - When a tool call is received from Gemini, invoke the executor and send the function response back to continue the conversation
    - Handle parallel tool calls if Gemini sends multiple at once

- [x] Integrate Google Calendar API for availability checks and event creation:
  - Create `server/tools/handlers/calendar.ts`:
    - Set up Google Calendar API client using a service account or OAuth2 (use service account for hackathon simplicity — the user shares their calendar with the service account email)
    - Install `googleapis` package if not already present
    - Implement `checkAvailability(date, timeStart, timeEnd)`:
      - Query Google Calendar freebusy API for the given time range
      - Return whether the user is free or busy, and list any conflicting events
    - Implement `createEvent(title, date, timeStart, timeEnd, description?, location?)`:
      - Create a calendar event using the Calendar API
      - Return confirmation with event ID and link
    - Implement `listUpcomingEvents(count?)`:
      - Fetch next N events from the primary calendar
      - Return formatted list for the AI to reference
  - Add new environment variables to `.env.example`:
    ```
    # Google Calendar (Service Account)
    GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
    GOOGLE_PRIVATE_KEY=your_private_key
    GOOGLE_CALENDAR_ID=primary
    ```
  - Update `server/config.ts` to include Google Calendar configuration
  - Wire the calendar handlers into `server/tools/executor.ts`

- [x] Implement outbound calling capability via Twilio REST API:
  - Create `server/twilio/outbound.ts`:
    - Implement `initiateOutboundCall(toNumber: string, purpose: string)`:
      - Use the Twilio REST API to create a new outbound call from the Voisli Twilio number
      - The call should connect to the same TwiML/WebSocket bridge so Gemini handles the outbound conversation
      - Pass the `purpose` as context to the Gemini session (e.g., "You are calling a restaurant to make a reservation for the user. The reservation details are: ...")
    - Handle call status callbacks (ringing, in-progress, completed, failed)
  - Create `server/gemini/prompts.ts` — system prompts for different conversation contexts:
    - `INBOUND_ASSISTANT_PROMPT` — for when a user calls Voisli: "You are Voisli, a helpful AI voice assistant. You can check the user's calendar, make reservations, and place calls on their behalf. Be conversational and concise."
    - `OUTBOUND_RESERVATION_PROMPT` — for when Voisli calls a restaurant: "You are calling on behalf of the user to make a reservation. Be polite and professional. State the reservation details clearly: party size, date, time, and name. Confirm all details before ending the call."
    - `OUTBOUND_GENERIC_PROMPT` — for general outbound calls
  - Update `server/callOrchestrator.ts` to:
    - Accept a `context` parameter that selects the appropriate system prompt
    - Support both inbound and outbound call types
    - Store call metadata (purpose, direction, outcome) in the CallSession
  - Wire the outbound call handler into `server/tools/executor.ts` so `make_outbound_call` triggers a real Twilio call

- [x] Create the search business stub and update the bridge server API:
  - Create `server/tools/handlers/search.ts`:
    - Implement `searchBusiness(query, location?)` as a stub that returns mock results:
      - Return 2-3 fake restaurant results with name, phone number, rating, and cuisine type
      - This is sufficient for hackathon demo — can be replaced with Google Places API later
  - Add new API endpoints to `server/index.ts`:
    - `GET /calls` — returns list of all calls (active and recent) with their metadata
    - `POST /calls/outbound` — manually initiate an outbound call (for testing): body accepts `{ toNumber, purpose }`
    - `GET /calls/:callSid` — get details of a specific call
  - Wire the search handler into `server/tools/executor.ts`

- [x] Update the Next.js dashboard to display call history and outbound call controls:
  - Search existing components in `src/components/` and pages in `src/app/` before creating new ones — reuse and extend existing code
  - Create `src/app/calls/page.tsx` — call history page:
    - Lists all calls (from `GET /calls` endpoint) with direction (inbound/outbound), status, duration, and purpose
    - Shows a timeline view of recent calls
    - For each call, show the tool calls that were made (calendar checks, reservations, etc.)
  - Update `src/app/page.tsx` dashboard to:
    - Add a "Make a Test Call" button that triggers `POST /calls/outbound` with a pre-filled restaurant number
    - Show recent call activity feed
  - Add navigation between dashboard and calls page (update layout or add a nav component)

- [x] Write tests for the tool calling system and audio pipeline:
  - Create `server/tools/__tests__/executor.test.ts`:
    - Test that each tool name routes to the correct handler
    - Test error handling when a handler throws
    - Test with mock calendar and search responses
  - Create `server/tools/__tests__/schema.test.ts`:
    - Validate all tool schemas have required fields (name, description, parameters)
    - Ensure parameter types are valid Gemini function declaration types
  - Create `server/audio/__tests__/converter.test.ts` (if not already created in Phase 1):
    - Round-trip mulaw encoding/decoding
    - Resampling buffer size validation
    - Full pipeline twilioToGemini → geminiToTwilio round-trip
  - **Note:** Audio converter tests already existed at `server/audio/converter.test.ts` (13 tests) from Phase 1 — skipped creating `__tests__` duplicate. Created executor tests (15 tests) and schema tests (18 tests). All 66 tests pass.

- [x] Run all tests and fix any failures. Verify the bridge server starts with the new tool schemas registered. Verify the Next.js dashboard builds and the new calls page renders correctly. Test the outbound call endpoint with a curl command to ensure it returns proper responses (even if Twilio credentials aren't configured, it should return a clear error).
  - **Note:** All 66 tests pass across 6 test files (executor 15, schema 18, audio converter 13, prompts, outbound, search). Next.js build succeeds with `/` and `/calls` routes generating as static pages. Bridge server starts cleanly on port 8080 with tool schemas registered (5 tools wired via `allToolSchemas`). Curl tests confirmed: `GET /status` returns JSON with service config, `POST /calls/outbound` returns clear Twilio-not-configured error, `GET /calls` returns empty list, `GET /calls/:callSid` returns 404 for unknown calls, validation rejects missing `toNumber`/`purpose` with 400 errors.

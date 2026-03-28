---
type: reference
title: Voisli Demo Runbook — End-to-End Test Plan
created: 2026-03-28
tags:
  - demo
  - testing
  - hackathon
related:
  - '[[VOISLI-05]]'
---

# Voisli Demo Runbook

Pre-demo checklist and step-by-step instructions for each demo flow.

## Pre-Demo Setup

1. **Start the servers**
   ```bash
   npm run dev
   ```
   This launches both the Next.js dashboard (port 3000) and the Express bridge server (port 8080).

2. **Run the readiness check**
   ```bash
   ./scripts/test-demo.sh
   ```
   Fix any failures before proceeding.

3. **Open the dashboard** at http://localhost:3000/demo

4. **Set up ngrok** (for Twilio inbound calls)
   ```bash
   ngrok http 8080
   ```
   Copy the HTTPS URL into `PUBLIC_SERVER_URL` in `.env` and restart the bridge server.

5. **Configure Twilio webhook** — In the Twilio console, set the voice webhook for your phone number to `{PUBLIC_SERVER_URL}/twiml`.

---

## Flow 1: Restaurant Reservation (Voice Call)

**Purpose:** Demonstrate AI voice assistant handling a phone call, checking a calendar, and creating a reservation.

### Expected Steps

1. **Trigger:** Open http://localhost:3000/demo → click "Start Demo Call" (initiates outbound call to test number) or call the Twilio number from a phone.
2. **AI answers:** Voisli greets the caller with a friendly introduction.
3. **User speaks:** "Hi, I'd like to make a dinner reservation for tonight at 7pm."
4. **AI action — Calendar check:** The AI invokes the `check_calendar` tool. The demo panel shows a tool card: "Checked calendar → Available at 7pm".
5. **AI responds:** "Great, 7pm tonight is open! Let me set that up for you."
6. **AI action — Create event:** The AI invokes `create_calendar_event`. Tool card appears: "Created event → Dinner at 7pm".
7. **AI confirms:** "All set! Your dinner reservation is confirmed for tonight at 7pm."
8. **Call ends:** User hangs up or AI says goodbye. The call status transitions from "active" → "ended" on the dashboard.

### What to Watch on the Dashboard
- Live call count increments on the main dashboard
- Activity feed shows "Call started" → "Tool invoked" → "Tool invoked" → "Call ended"
- Calls page shows the call with live status
- Demo panel shows tool call cards inline

### Troubleshooting
- **No audio:** Check that Gemini API key is valid and the WebSocket connection is established (check bridge server logs).
- **Tools not called:** Ensure Google Calendar credentials are configured. The AI will acknowledge errors vocally if calendar is unavailable.
- **Twilio error:** Verify PUBLIC_SERVER_URL and webhook configuration.

---

## Flow 2: Meeting Assistant

**Purpose:** Demonstrate the Recall.ai-powered meeting bot joining a video call, transcribing, and speaking.

### Expected Steps

1. **Trigger:** Open http://localhost:3000/demo → paste a Google Meet URL in the "Join Meeting" input → click "Join Meeting".
2. **Bot joins:** The Recall.ai bot (named "Voisli") appears in the meeting. Dashboard shows "Meeting joined" in the activity feed.
3. **Participants speak:** The bot listens and streams transcript updates. The demo panel shows live transcript with speaker colors.
4. **Ask the bot:** Say "Hey Voisli, can you summarize what we've discussed?" (or use the "Ask the Bot" simulation button on the demo page).
5. **Bot responds:** The bot speaks a summary. The transcript highlights the bot's response with a different background color.
6. **Bot leaves:** Click "Leave Meeting" on the demo panel or the meetings page.

### What to Watch on the Dashboard
- Live meeting count increments on the main dashboard
- Activity feed shows "Meeting joined" → "Transcript update" (repeated) → "Bot spoke" → optionally "Meeting ended"
- Meeting detail page (`/meetings/{botId}`) shows streaming transcript
- Speaker names appear with distinct colors

### Troubleshooting
- **Bot doesn't join:** Check RECALL_API_KEY is valid. The Recall.ai API must be reachable.
- **No transcript:** Verify the meeting has audio. The bot needs participants to be speaking.
- **Bot doesn't speak:** Ensure Gemini API is configured — the bot uses Gemini to generate responses.

---

## Flow 3: MCP Integration

**Purpose:** Demonstrate that Voisli exposes tools via the Model Context Protocol, allowing Claude (or any MCP client) to orchestrate calls and meetings.

### Expected Steps

1. **View tools:** Open http://localhost:3000/demo → scroll to the MCP section. The tool list displays all 8 registered tools.
2. **Show config:** The demo panel shows the `mcp-config.json` snippet. Copy it into Claude Desktop's or Claude Code's MCP configuration.
3. **Invoke via Claude:** In Claude, say "Call +15551234567 and ask about their dinner specials" or "Check my calendar for tomorrow."
4. **Watch the log:** MCP tool invocations appear in the demo panel's live log. Each invocation shows the tool name, parameters, and result.
5. **Verify round-trip:** The bridge server processes the MCP request, the dashboard reflects the action (new call appears, calendar result returned).

### What to Watch on the Dashboard
- MCP tool list shows 8 tools and 5 resources
- Live log of tool invocations in the demo panel
- Actions triggered by MCP (calls, meetings) appear on the respective dashboard pages

### MCP Tools Reference
| Tool | Description |
|------|-------------|
| `make_call` | Initiate an outbound phone call |
| `join_meeting` | Send bot to a video meeting |
| `leave_meeting` | Remove bot from meeting |
| `check_calendar` | Query calendar availability |
| `create_calendar_event` | Create a calendar event |
| `get_call_status` | Check call status/details |
| `get_meeting_summary` | Get AI-generated meeting summary |
| `get_meeting_transcript` | Get full meeting transcript |

### Troubleshooting
- **MCP server won't start:** Run `npm run mcp` directly and check for errors. Ensure `tsx` is available.
- **Tools fail:** The MCP server calls the bridge server at `BRIDGE_SERVER_URL`. Ensure the bridge is running.

---

## Post-Demo Checklist

- [ ] All three flows demonstrated successfully
- [ ] Dashboard showed real-time updates throughout
- [ ] No error states visible on the dashboard
- [ ] Health check endpoint reports healthy/degraded (not down)

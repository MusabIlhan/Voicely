# Voisli Demo Script

**Duration:** ~8 minutes
**Setup:** Bridge server + Next.js running, ngrok tunnel active, `/demo` page open on projector

---

## Pre-demo checklist

```bash
./scripts/test-demo.sh
```

- [ ] `npm run dev` running (bridge on 8080, dashboard on 3001)
- [ ] `ngrok http 8080` running, URL set in `.env` as `PUBLIC_SERVER_URL`
- [ ] Twilio webhook configured to `{ngrok_url}/twiml`
- [ ] `.env` has `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `GEMINI_API_KEY`
- [ ] Browser open to `http://localhost:3001/demo`
- [ ] All three status pills show green (Bridge Server, Twilio, Gemini)
- [ ] Collapse the onboarding section before presenting

---

## Act 1: "The Problem" (1 min)

**Talking points:**

> "Every business makes phone calls and joins meetings. But these interactions are black boxes — no transcripts, no context, no automation. What if your AI assistant could pick up the phone for you, or join a meeting and take notes in real time?"

- Frame the pain: manual calls are slow, meetings produce no actionable data
- Introduce Voisli: an AI voice agent that handles calls and meetings, powered by Gemini Live

---

## Act 2: "The Demo" (5 min)

### Flow 1: Restaurant Reservation (~2 min)

1. **Click "Start Demo Call"** on the demo page
2. Narrate as the live activity feed populates:
   > "The AI is now on a real phone call via Twilio. It's speaking, listening, and reasoning in real time using Gemini's multimodal audio API — no pre-scripted responses."
3. Point out tool invocations as they appear (calendar check, event creation):
   > "Watch — it just checked my calendar for availability and is now creating a reservation event. All of this is happening live."
4. When the call ends, the flow badge turns to "Completed"

**If Twilio isn't configured:** Walk through the architecture using the onboarding steps. Show the code flow: Twilio WebSocket -> mulaw audio -> Gemini Live API -> TTS response back.

### Flow 2: Meeting Assistant (~2 min)

1. **Paste a Google Meet URL** and click "Join Meeting"
2. While the bot joins, explain:
   > "We're sending an AI bot into this Google Meet via Recall.ai. It joins as a participant, transcribes in real time, and can answer questions."
3. Show the live transcript streaming in as people speak
4. Use the "Ask the Bot" simulator if no live meeting:
   > "In a live meeting, anyone can say 'Hey Voisli, summarize what we discussed' and the bot will answer."
5. Point out the speaker colors and bot response highlighting

**If Recall.ai isn't configured:** Use the "Ask the Bot" simulator to show the transcript UI and bot response flow.

### Flow 3: MCP Integration (~1 min)

1. **Scroll to Flow 3** on the demo page
2. Show the 8 MCP tools listed:
   > "All of this is exposed as an MCP server. That means Claude Desktop or Claude Code can use these tools directly."
3. Show the config snippet — copy button for easy setup
4. If Claude is connected, trigger a tool call and watch it appear in the MCP log:
   > "When Claude calls `make_call` or `join_meeting`, the invocation shows up here in real time via SSE."

---

## Act 3: "The Architecture" (2 min)

**Switch to the dashboard (`/`) briefly:**

> "Under the hood, we have a bridge server that orchestrates everything. Twilio handles telephony, Gemini handles the AI conversation, and Recall.ai handles meeting integration."

**Key architecture points:**

- **Real-time audio pipeline:** Twilio mulaw 8kHz -> native Deepgram/Gemini STT (no transcoding) -> Gemini reasoning -> TTS -> mulaw back to Twilio
- **Meetings are text-based:** Recall.ai provides transcripts, Gemini generates text responses, separate TTS step sends audio back
- **SSE for live updates:** Every call, tool invocation, and transcript update streams to the dashboard in real time
- **MCP protocol:** Standard interface so any AI client can use Voisli as a tool provider

**Closing:**

> "We built this in [timeframe]. The entire system is ~3k lines of TypeScript. The AI isn't scripted — it genuinely reasons about each interaction. Questions?"

---

## Fallback plans

| Issue | Recovery |
|---|---|
| Bridge server down | Restart with `npm run dev`, takes ~5s |
| Twilio not connected | Skip Flow 1, explain architecture with onboarding steps |
| Recall.ai not connected | Skip live meeting join, use "Ask the Bot" simulator |
| SSE not connecting | Refresh the page, check bridge server is running |
| Gemini API error | Check API key in `.env`, restart bridge server |
| Audio quality poor | Mention this is mulaw 8kHz (telephony grade), production would use wideband |

---

## Audience Q&A cheat sheet

| Question | Answer |
|---|---|
| "What LLM powers this?" | Gemini 2.5 Flash via the Live API for real-time audio, and for meeting text responses. Swappable. |
| "How fast is the response?" | Sub-second for Gemini Live (streaming audio). Meeting responses take 2-3s for text generation + TTS. |
| "Can it handle interruptions?" | Yes — Gemini Live supports barge-in detection. The agent stops speaking when the user talks. |
| "What about latency?" | ~200ms round-trip for audio. Twilio adds ~100ms. Total perceived latency is ~300-500ms. |
| "Is this production-ready?" | Demo/MVP stage. For production: add persistent storage, session recovery, rate limiting, and monitoring. |
| "Cost per call?" | Gemini API cost (~$0.01-0.05/min) + Twilio (~$0.02/min) + Recall.ai (per-bot pricing). |

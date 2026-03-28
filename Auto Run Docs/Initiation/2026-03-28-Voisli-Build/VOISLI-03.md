# Phase 03: Meeting Bot with Recall.ai — Join Google Meet & Speak Out Loud

This phase builds the meeting assistant feature: Voisli joins a Google Meet call as a bot participant via Recall.ai, listens to the conversation in real-time, builds context about what's being discussed, and can answer questions out loud when addressed. The bot uses Gemini to understand the meeting context and generate spoken responses, and has access to the same tools (calendar, search) so it can answer questions like "when is our next standup?" directly in the meeting. This is the B2B killer feature — an AI team member that has full context and can participate vocally.

## Tasks

- [x] Set up Recall.ai integration and bot lifecycle management:
  - Install the Recall.ai SDK or set up HTTP client for their REST API (check if `@recallai/sdk` npm package exists, otherwise use fetch/axios with their REST endpoints)
  - Add environment variables to `.env.example`:
    ```
    # Recall.ai
    RECALL_API_KEY=your_recall_api_key
    RECALL_API_BASE_URL=https://us-west-2.recall.ai/api/v1
    ```
  - Update `server/config.ts` with Recall.ai configuration
  - Create `server/meeting/recallClient.ts`:
    - `createBot(meetingUrl: string, botName?: string)` — creates a Recall.ai bot and sends it to join the meeting. Configure:
      - Bot name: "Voisli Assistant" (or custom)
      - Enable real-time transcription
      - Enable real-time audio output (so the bot can speak)
      - Set up webhook URLs for bot status changes and transcription events
    - `removeBot(botId: string)` — remove bot from meeting
    - `getBotStatus(botId: string)` — check if bot is in the meeting, recording, etc.
    - `sendAudioToMeeting(botId: string, audioData: Buffer)` — send audio output to the meeting so the bot speaks out loud. Use Recall.ai's real-time output API
    - `listActiveBots()` — return all currently active meeting bots
  - Create `server/meeting/types.ts` with interfaces:
    - `MeetingSession` — botId, meetingUrl, status, participants, startedAt, contextWindow
    - `TranscriptEntry` — speaker, text, timestamp
    - `MeetingParticipant` — name, speakerId

- [ ] Build the real-time meeting transcription and context management pipeline:
  - Create `server/meeting/contextManager.ts`:
    - Maintains a rolling context window of the meeting conversation (last N minutes or last M transcript entries)
    - `addTranscriptEntry(entry: TranscriptEntry)` — adds a new transcript line with speaker attribution
    - `getContext()` — returns the formatted meeting context as a string for Gemini (includes participant list, recent conversation, detected topics)
    - `getSummary()` — generates a concise summary of the meeting so far (topics discussed, decisions made, action items mentioned)
    - `detectBotMention(entry: TranscriptEntry)` — checks if the latest transcript entry is addressing the bot (mentions "Voisli", "hey assistant", "bot", or a direct question pattern)
    - Track per-speaker statistics (how much each person has spoken)
  - Create `server/meeting/webhooks.ts` — Express routes for Recall.ai webhook callbacks:
    - `POST /webhooks/recall/transcript` — receives real-time transcript events, feeds them to the context manager
    - `POST /webhooks/recall/status` — receives bot status changes (joining, in_call, done)
    - `POST /webhooks/recall/audio` — receives audio data if using audio-based processing
    - Mount these routes in `server/index.ts`

- [ ] Implement the meeting AI brain — Gemini integration for meeting Q&A:
  - Create `server/meeting/meetingAI.ts`:
    - Creates a Gemini session (can use standard Gemini API or Live API depending on Recall.ai's audio capabilities) specifically for meeting context
    - System prompt for meeting assistant mode (add to `server/gemini/prompts.ts`):
      ```
      MEETING_ASSISTANT_PROMPT: "You are Voisli, an AI assistant participating in a meeting.
      You have access to the full meeting transcript and context.
      When someone asks you a question or mentions your name, respond helpfully and concisely.
      You can check calendars, look up information, and help with scheduling.
      Keep responses brief — you're in a live meeting and shouldn't monopolize speaking time.
      Always reference specific things said in the meeting when relevant."
      ```
    - `handleQuestion(question: string, meetingContext: string)` — sends the question + full meeting context to Gemini, gets a text response
    - `generateAudioResponse(text: string)` — converts the text response to speech audio using Gemini's TTS or a separate TTS call, returns audio buffer suitable for Recall.ai output
    - Has access to the same tools as the phone assistant (calendar, search) via the existing tool executor
  - Create `server/meeting/meetingOrchestrator.ts` — ties everything together for a meeting session:
    - When a bot is created, initializes the context manager and AI brain
    - On each transcript event: updates context, checks for bot mention
    - When bot is mentioned/questioned: extracts the question, passes to meetingAI with context, gets audio response, sends audio back to meeting via Recall.ai
    - Manages the full lifecycle: join → listen → respond → leave
    - Implements a cooldown to prevent the bot from responding too frequently
    - Stores meeting session data for post-meeting summary

- [ ] Create API endpoints for meeting bot management and update the dashboard:
  - Add to `server/index.ts`:
    - `POST /meetings/join` — body: `{ meetingUrl, botName? }` — creates a Recall.ai bot and sends it to the meeting
    - `GET /meetings` — lists all meeting sessions (active and past)
    - `GET /meetings/:botId` — get details of a specific meeting session including transcript
    - `POST /meetings/:botId/leave` — remove bot from the meeting
    - `GET /meetings/:botId/summary` — get AI-generated meeting summary
    - `GET /meetings/:botId/transcript` — get full transcript
  - Register the `join_meeting` tool in `server/tools/schema.ts` so the phone assistant can also trigger meeting joins:
    - `join_meeting` — params: meeting_url (string), bot_name (string, optional). Description: "Send the Voisli AI assistant to join a Google Meet meeting"
  - Wire the new tool into `server/tools/executor.ts`

- [ ] Build the meeting dashboard UI in Next.js:
  - Search existing components and pages before creating new files — extend existing navigation and patterns
  - Create `src/app/meetings/page.tsx` — meetings overview page:
    - "Join a Meeting" form with meeting URL input and submit button (calls `POST /meetings/join`)
    - List of active meeting sessions with status indicator (joining, in-call, done)
    - List of past meetings with links to summaries
  - Create `src/app/meetings/[botId]/page.tsx` — individual meeting detail page:
    - Live transcript view (polls for updates or uses SSE) showing speaker-attributed text
    - Meeting status and participant list
    - "Leave Meeting" button
    - AI-generated summary section (available during and after the meeting)
  - Update the main dashboard (`src/app/page.tsx`) to show active meetings count alongside active calls
  - Update navigation to include the Meetings page

- [ ] Write tests for the meeting system:
  - Create `server/meeting/__tests__/contextManager.test.ts`:
    - Test adding transcript entries and retrieving formatted context
    - Test the rolling window (old entries get trimmed)
    - Test bot mention detection with various patterns ("Voisli", "hey assistant", "can the bot answer")
    - Test speaker tracking
  - Create `server/meeting/__tests__/meetingOrchestrator.test.ts`:
    - Test the question detection → AI response → audio output pipeline with mocked Recall.ai and Gemini clients
    - Test cooldown logic
    - Test meeting lifecycle (join → active → leave)

- [ ] Run all tests (existing and new) and fix any failures. Verify the bridge server starts with the new meeting endpoints registered. Verify the Next.js dashboard builds and the meetings pages render correctly. Test the meeting join endpoint with a curl command to verify it accepts the right payload format.

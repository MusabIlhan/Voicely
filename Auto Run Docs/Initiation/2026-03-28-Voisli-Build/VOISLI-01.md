# Phase 01: Project Foundation & Working Voice Call Bridge

This phase sets up the entire Voisli project from scratch and delivers the core feature: a working phone call bridge between Twilio and Google's Gemini 3.1 Flash Live model. By the end of this phase, the project will have a Next.js dashboard running alongside a WebSocket bridge server that connects Twilio phone calls to Gemini's real-time voice AI. Once API keys are added, calling the Twilio number will connect you to a live AI voice conversation powered by Gemini — the foundational magic of the entire product.

## Architecture Overview

The system has two runtime processes:

1. **Next.js Dashboard** (port 3000) — Web UI showing branding, active call status, and setup instructions
2. **Bridge Server** (port 8080) — Express + WebSocket server that:
   - Serves TwiML XML telling Twilio to connect via WebSocket
   - Accepts Twilio Media Stream WebSocket connections (mulaw audio, 8kHz)
   - Connects to Gemini 3.1 Flash Live API via WebSocket (PCM audio, 16kHz)
   - Converts audio formats bidirectionally between the two

```
Phone Call → Twilio → WebSocket (mulaw 8kHz) → Bridge Server → Gemini Live API (PCM 16kHz)
                                                      ↕ audio conversion
Phone Call ← Twilio ← WebSocket (mulaw 8kHz) ← Bridge Server ← Gemini Live API (PCM 16kHz)
```

## Tasks

- [x] Initialize the Next.js project with TypeScript and install all dependencies. Use `create-next-app` with TypeScript and App Router. Then install these additional dependencies:
  - `twilio` — Twilio SDK for REST API and TwiML generation
  - `ws` and `@types/ws` — WebSocket library for the bridge server
  - `express` and `@types/express` — HTTP server for TwiML webhook and bridge server
  - `@google/genai` — Google's Generative AI SDK (supports Gemini Live API)
  - `dotenv` — Environment variable loading
  - `tsx` — TypeScript execution for the bridge server
  - `concurrently` — Run Next.js and bridge server simultaneously
  - Create the project directory structure:
    ```
    voisli/
    ├── src/app/              — Next.js App Router pages
    ├── src/components/       — React components
    ├── server/               — Bridge server code
    │   ├── index.ts          — Express + WS entry point
    │   ├── config.ts         — Environment validation
    │   ├── twilio/           — Twilio handlers
    │   ├── gemini/           — Gemini Live API client
    │   └── audio/            — Audio format conversion
    ├── shared/               — Shared types between frontend and server
    │   └── types.ts
    ```
  - Add npm scripts to `package.json`:
    - `"dev"` — uses concurrently to run both `next dev` and `tsx watch server/index.ts`
    - `"dev:web"` — runs only `next dev`
    - `"dev:server"` — runs only `tsx watch server/index.ts`
    - `"build"` — builds the Next.js app
  - Configure `tsconfig.json` to support both Next.js (src/) and the standalone server (server/) — use path aliases like `@/` for src and `@server/` for server

- [ ] Create environment configuration and shared type definitions:
  - Create `.env.example` with clearly documented variables:
    ```
    # Twilio Configuration
    TWILIO_ACCOUNT_SID=your_account_sid
    TWILIO_AUTH_TOKEN=your_auth_token
    TWILIO_PHONE_NUMBER=+1234567890

    # Google Gemini API
    GEMINI_API_KEY=your_gemini_api_key

    # Server Configuration
    BRIDGE_SERVER_PORT=8080
    BRIDGE_SERVER_HOST=localhost
    NEXT_PUBLIC_BRIDGE_SERVER_URL=http://localhost:8080

    # For production/ngrok — the public URL where Twilio can reach the bridge server
    PUBLIC_SERVER_URL=https://your-ngrok-url.ngrok.io
    ```
  - Create `server/config.ts` that:
    - Loads dotenv
    - Exports a typed config object with all environment variables
    - Validates required variables are present at startup (throw clear errors if missing)
    - Has a `isConfigured()` helper that returns which services are ready
  - Create `shared/types.ts` with TypeScript interfaces:
    - `CallSession` — id, twilioCallSid, status (connecting/active/ended), startedAt, endedAt
    - `TwilioMediaMessage` — the JSON message types Twilio sends over WebSocket (connected, start, media, stop, mark)
    - `BridgeServerStatus` — activeCalls, uptime, configured services
    - `GeminiConfig` — model name, system instruction, voice settings, tools

- [ ] Build the Twilio integration layer in `server/twilio/`:
  - Create `server/twilio/webhooks.ts`:
    - Export an Express router with a `POST /twiml` endpoint
    - Returns TwiML XML that uses `<Connect><Stream>` to open a bidirectional WebSocket media stream to the bridge server
    - The WebSocket URL should be constructed from the `PUBLIC_SERVER_URL` env var (e.g., `wss://your-ngrok-url.ngrok.io/media-stream`)
    - Use the Twilio SDK's `VoiceResponse` class to generate valid TwiML
    - Include a `<Say>` greeting before the stream (e.g., "Connecting you to Voisli")
  - Create `server/twilio/mediaStream.ts`:
    - Export a function `handleTwilioMediaStream(ws: WebSocket)` that manages a single Twilio media stream connection
    - Parse incoming JSON messages by event type: `connected`, `start`, `media`, `stop`, `mark`
    - On `start` — extract streamSid, callSid, and media format metadata
    - On `media` — decode the base64 mulaw audio payload and emit it via a callback
    - Provide a `sendAudio(base64MulawAudio: string)` method to send audio back to Twilio via the `media` message format
    - Provide a `sendMark(name: string)` method for synchronization
    - Handle connection close and errors gracefully
    - Use an EventEmitter pattern or callback pattern so the orchestrator can plug in

- [ ] Build the Gemini 3.1 Flash Live API client in `server/gemini/`:
  - Create `server/gemini/liveClient.ts`:
    - Use the `@google/genai` SDK to establish a Gemini Live API session
    - Use the latest Gemini model that supports the Live/real-time multimodal API (check SDK docs — likely `gemini-2.0-flash-live-001` or newer). The model must support bidirectional audio streaming
    - Configure the session with:
      - Audio input format: PCM 16-bit, 16kHz mono
      - Audio output: enabled, configured for voice response
      - System instruction: "You are Voisli, a helpful AI voice assistant. You help users make phone calls, reservations, and manage their schedule. Be conversational, concise, and friendly. Keep responses short since this is a voice conversation."
      - Voice config: select a natural-sounding voice from available options
    - Export a `GeminiLiveSession` class/interface with:
      - `connect()` — establishes the WebSocket session
      - `sendAudio(pcmAudio: Buffer)` — sends PCM audio chunks to Gemini
      - `onAudio(callback: (pcmAudio: Buffer) => void)` — receive audio output from Gemini
      - `onText(callback: (text: string) => void)` — receive text transcription
      - `onToolCall(callback: (toolCall) => void)` — for future tool/function calling
      - `onInterrupted(callback: () => void)` — handle barge-in/interruption
      - `close()` — cleanly disconnect
    - Handle reconnection logic and session errors
    - Log key events (connection established, audio flowing, errors) for debugging

- [ ] Create audio format conversion utilities in `server/audio/`:
  - Create `server/audio/converter.ts` with pure TypeScript implementations (no native dependencies — important for hackathon portability):
    - `mulawToLinear(mulawBytes: Buffer): Buffer` — decode G.711 μ-law to 16-bit linear PCM
      - Implement the standard mulaw decode table/algorithm (bias of 33, 8-bit to 16-bit expansion)
    - `linearToMulaw(pcmBytes: Buffer): Buffer` — encode 16-bit linear PCM to G.711 μ-law
      - Implement the standard mulaw encode algorithm (compress 16-bit to 8-bit)
    - `resample8kTo16k(pcm8k: Buffer): Buffer` — upsample from 8kHz to 16kHz
      - Use linear interpolation (simple and good enough for voice)
    - `resample16kTo8k(pcm16k: Buffer): Buffer` — downsample from 16kHz to 8kHz
      - Average adjacent samples
    - `twilioToGemini(base64Mulaw: string): Buffer` — full pipeline: base64 decode → mulaw to linear → resample 8k→16k → return PCM 16kHz buffer
    - `geminiToTwilio(pcm16k: Buffer): string` — full pipeline: resample 16k→8k → linear to mulaw → base64 encode → return string
  - Create `server/audio/converter.test.ts` — basic sanity tests:
    - Round-trip test: encode then decode should produce similar values
    - Verify buffer sizes are correct after resampling (2x for upsample, 0.5x for downsample)

- [ ] Wire up the complete call orchestrator and bridge server entry point:
  - Create `server/callOrchestrator.ts`:
    - Manages the lifecycle of a single call session
    - Accepts a Twilio WebSocket and creates a corresponding Gemini Live session
    - Wires audio flow: Twilio audio → `twilioToGemini()` → Gemini, and Gemini audio → `geminiToTwilio()` → Twilio
    - Tracks call state (CallSession type) and emits status updates
    - Handles cleanup when either side disconnects
    - Buffers audio appropriately (Gemini may need minimum chunk sizes)
  - Create `server/callManager.ts`:
    - Maintains a Map of active CallSessions by callSid
    - Provides `getActiveCalls()`, `getCallCount()` for the dashboard API
    - Cleans up ended sessions
  - Create `server/index.ts` — the main bridge server entry point:
    - Initialize Express app on port 8080 (from config)
    - Mount Twilio webhook routes (`/twiml`)
    - Add a `GET /status` JSON endpoint returning `BridgeServerStatus` (active calls, uptime, which services are configured)
    - Add CORS headers for Next.js dashboard to call the status endpoint
    - Create a WebSocket server on the `/media-stream` path
    - On new WebSocket connection: create a callOrchestrator instance that bridges Twilio ↔ Gemini
    - Log startup info: port, configured services, public URL
    - Handle graceful shutdown (close all active sessions on SIGINT/SIGTERM)

- [ ] Build the Next.js dashboard with project branding and live connection status:
  - Create `src/app/layout.tsx` with:
    - Clean, modern layout with dark theme (use Tailwind CSS — it comes with create-next-app)
    - App title "Voisli" in the metadata
    - A minimal sidebar or top nav with the Voisli logo/name
  - Create `src/app/page.tsx` as the main dashboard:
    - Hero section with "Voisli" branding and tagline: "Your AI Voice Assistant"
    - A status card that polls `GET /status` from the bridge server every 5 seconds:
      - Shows bridge server connection status (online/offline)
      - Shows number of active calls
      - Shows which services are configured (Twilio ✓/✗, Gemini ✓/✗)
    - A "Quick Setup" section showing what environment variables need to be configured (reads from bridge server status)
    - A "How to Test" section with steps: 1) Configure .env, 2) Start ngrok, 3) Set Twilio webhook URL, 4) Call your Twilio number
    - Active calls list (even if empty, show the UI ready for calls)
    - Use Tailwind for styling — dark background (slate-900), accent color (violet or indigo), clean cards with subtle borders
  - Create `src/components/StatusCard.tsx` — reusable card component showing a service's status with icon and label
  - Create `src/components/ActiveCalls.tsx` — component listing active calls with duration timer

- [ ] Create development startup scripts and verify everything compiles:
  - Update `package.json` scripts to ensure `"dev"` runs both servers via concurrently with colored output labels: `[web]` for Next.js, `[bridge]` for the bridge server
  - Create a `.env` file by copying `.env.example` (with placeholder values so the servers start without crashing — config validation should warn but not exit if keys are missing, to allow the dashboard to render)
  - Run `npm run build` to verify the Next.js app compiles without TypeScript errors
  - Run `npx tsx server/index.ts` briefly to verify the bridge server starts (it should log its status and that API keys are not yet configured)
  - Fix any TypeScript errors, import issues, or missing type definitions
  - Verify that `npm run dev` starts both processes and the dashboard is accessible at http://localhost:3000 showing the status UI
  - Run any audio converter tests to make sure the conversion utilities work correctly

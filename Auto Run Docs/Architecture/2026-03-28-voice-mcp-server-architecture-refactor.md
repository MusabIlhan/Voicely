# Voice MCP Server Architecture Refactor

This document is the canonical source of truth for the Voice MCP server refactor. It explains both the **previous architecture** and the **target architecture**, so engineers can understand what is changing, what remains, what must be removed, and how to migrate safely.

## 1. Purpose and Scope

### In scope

- The Voice MCP server
- Its runtime architecture
- Its Twilio and Recall transport adapters
- Its Gemini STT/TTS boundary
- Its authenticated HTTP integration with the external main agent

### Out of scope

- The main agent itself
- Main-agent reasoning internals
- Any non-voice orchestration outside the Voice MCP server

The main agent is **external**. The Voice MCP server is responsible only for session orchestration, transport integration, speech input/output, and exact-once lifecycle handling.

## 2. Refactor Framing: Before -> After

## Before

The previous system was effectively a broader bridge-style architecture:

- MCP exposed a wider or less tightly bounded runtime surface.
- A bridge server pattern mixed transport wiring, session lifecycle handling, and agent interaction more loosely.
- Gemini could sit too close to runtime reasoning or tool-calling paths.
- Session state was spread across provider-specific flows rather than enforced through one unified per-session runtime object.
- Twilio and Recall orchestration were adapter-driven, but not yet fully normalized behind one strict session contract.
- Runtime behavior around duplicates, out-of-order callbacks, and terminal races was more implementation-dependent than specification-driven.

## After

The new architecture is a **session-centric voice runtime**:

- MCP exposes only two active tools.
- The runtime is a **long-lived process** with **strict per-session isolation**.
- Every session is keyed by `session_id` and managed through one unified in-memory `VoiceSessionBuffer`.
- Gemini is limited to **STT/TTS only**.
- The main agent is integrated only through authenticated `POST /assist` and `POST /session-end`.
- `/assist` receives only the last 5-10 turns, with one in-flight request per session.
- Stale assist responses are never spoken.
- Once a session enters `ending`, queued unsaid TTS is dropped and in-flight assist output is ignored or canceled.
- Twilio and Recall lifecycle handling both follow exact-once finalization rules.

## Explicitly removed

- Gemini reasoning in the active runtime path
- Gemini tool-calling in the active runtime path
- Broad or ambiguous MCP runtime surface beyond the two active tools
- Any architecture that lets provider-specific state become the primary source of truth instead of `session_id`
- Any design that forwards full transcripts to `/assist`
- Any design that allows multiple concurrent assist requests for one session without freshness suppression

## Explicitly replaced

- Old bridge-style orchestration -> session-centric voice runtime boundary
- Distributed provider-first session handling -> unified `VoiceSessionBuffer`
- Implicit response freshness behavior -> explicit turn-based stale-response suppression
- Best-effort termination flows -> exact-once terminal finalization

## Explicitly retained

- Twilio for phone transport
- Recall for meeting transport
- Gemini for speech input/output
- MCP as the external invocation surface
- External main-agent integration, now narrowed and formalized

## 3. Current vs Target Comparison

### 3.1 MCP surface

**Previous:** broader or less tightly constrained MCP exposure, with architecture that could imply more runtime-facing operations.

**Target:** only these MCP tools are active:

```ts
initiate_call(phone_number, session_id)
join_meeting(meeting_url, session_id)
```

Rules:

- `session_id` is mandatory.
- `session_id` is the primary correlation key everywhere.
- No new runtime-facing MCP tools should be added without updating this spec.

### 3.2 Bridge-server pattern vs voice-runtime boundary

**Previous:** a bridge-server pattern combined transport integration, agent interaction, and callback management in a looser boundary.

**Target:** a dedicated voice runtime boundary:

- transport adapters feed session events into runtime core,
- runtime core owns session state,
- runtime core owns assist concurrency,
- runtime core decides what can be spoken,
- runtime core owns exact-once termination,
- external main-agent integration happens only through HTTP contracts.

### 3.3 Gemini reasoning/tool-calling path vs Gemini STT/TTS-only boundary

**Previous:** Gemini could be treated as more than a speech layer, potentially overlapping with reasoning or tool-calling concerns.

**Target:** Gemini is used for **speech-to-text** and **text-to-speech only**.

Explicitly excluded from the active runtime path:

- Gemini reasoning
- Gemini tool-calling
- Gemini-led orchestration

Target runtime path:

```text
audio in -> Gemini STT -> VoiceSessionBuffer -> external main agent (/assist) -> validated text response -> Gemini TTS -> audio out
```

### 3.4 Old session handling vs new `VoiceSessionBuffer`

**Previous:** session data could be fragmented across transport handlers, callback flows, and provider-specific state.

**Target:** each session owns one unified in-memory runtime object:

```ts
type VoiceSessionBuffer = {
  sessionId: string;
  transcript: TranscriptTurn[];
  status: 'active' | 'ending' | 'ended';
  assist: {
    inFlight: boolean;
    activeTurnId?: string;
  };
  output: {
    queuedTts: TtsItem[];
  };
  provider: {
    twilio?: TwilioSessionState;
    recall?: RecallSessionState;
  };
  sessionEnd: {
    sent: boolean;
    acknowledged: boolean;
  };
};
```

Rules:

- The buffer is keyed by `session_id`.
- All mutable runtime state is partitioned by `session_id`.
- The full transcript is retained until exact-once `/session-end` success.

### 3.5 Old Twilio routing vs new session-specific TwiML and media-stream routing

**Previous:** Twilio routing existed, but the new architecture requires a stricter per-session boundary and terminal-race behavior.

**Target:**

```http
POST /twiml/{session_id}
WS   /media-stream/{session_id}
```

Rules:

- TwiML is generated per session.
- Media websocket traffic binds only to the matching `session_id` buffer.
- While waiting on `/assist`, a filler phrase is spoken immediately.
- Websocket-close vs status-callback races are handled with exact-once finalization.

### 3.6 Old Recall orchestration vs new session-aware external-assist orchestration

**Previous:** Recall behavior existed as meeting orchestration, but without this spec’s final session-centric assist contract.

**Target:**

- `session_id <-> bot_id` is explicitly correlated.
- Recall events feed the shared runtime model, not an adapter-owned parallel state machine.
- Responses are queued and spoken only at natural gaps.
- Duplicate and out-of-order terminal events are absorbed by exact-once finalization rules.

## 4. Target Architecture Overview

The target system is a **long-lived process with strict per-session isolation**.

High-level flow:

```text
MCP tool call
  -> session created by session_id
  -> transport adapter attached (Twilio or Recall)
  -> Gemini STT produces transcript turns
  -> runtime stores transcript in VoiceSessionBuffer
  -> runtime sends recent turns to external /assist
  -> runtime validates /assist response at boundary
  -> runtime queues or speaks safe current response
  -> terminal event moves session to ending
  -> runtime suppresses stale outputs
  -> runtime posts full transcript to /session-end
  -> runtime finalizes exactly once on success
```

## 5. Subsystem Refactor Map

### 5.1 MCP layer

**Previous role:** broader invocation and bridge entrypoint surface.

**Target role:** thin invocation layer that creates or starts a sessionized voice workflow.

Target API:

```ts
initiate_call(phone_number, session_id)
join_meeting(meeting_url, session_id)
```

Refactor actions:

- Remove or disable runtime-facing MCP tools beyond the two approved tools.
- Enforce required `session_id` at invocation boundary.
- Route both tools into the same session-oriented runtime core.

### 5.2 Session store / runtime core

**Previous role:** session state spread across transport-specific and orchestration-specific paths.

**Target role:** single source of truth for all live session state.

Refactor actions:

- Introduce or consolidate `VoiceSessionBuffer` as the canonical session object.
- Key all runtime state by `session_id`.
- Keep transcript, assist status, output queue, provider state, and terminal bookkeeping in one object.
- Make `ending` a one-way state transition.
- Delay cleanup until `/session-end` succeeds exactly once.

### 5.3 Main-agent HTTP client

**Previous role:** looser bridge behavior or less tightly specified callback handling.

**Target role:** authenticated, validated, freshness-aware callback client.

Endpoints:

```http
POST /assist
POST /session-end
Authorization: Bearer <token>
```

Refactor actions:

- Send only the last 5-10 turns to `/assist`.
- Never send full transcript to `/assist`.
- Enforce at most one in-flight assist per session.
- Include `turn_id` or equivalent freshness token on assist requests.
- Parse and validate assist responses at the HTTP boundary.
- Treat malformed assist responses as fallback-triggering failures.
- Treat any 2xx `/session-end` response as success.
- Optionally treat explicit safe duplicate acknowledgements as success-equivalent.

### 5.4 Twilio adapter

**Previous role:** phone transport wiring under the older bridge pattern.

**Target role:** session-specific phone transport adapter governed by runtime core.

Target endpoints:

```http
POST /twiml/{session_id}
WS   /media-stream/{session_id}
```

Refactor actions:

- Generate TwiML per session.
- Bind websocket stream handling to the correct session buffer.
- Emit a filler phrase immediately while waiting on `/assist`.
- Normalize terminal callbacks into one exact-once finalization path.
- Ensure websocket-close and status-callback races cannot double-finalize a session.

### 5.5 Recall adapter

**Previous role:** meeting bot orchestration that could retain more adapter-local control over flow.

**Target role:** session-aware meeting adapter feeding the shared runtime model.

Refactor actions:

- Persist `session_id <-> bot_id` correlation.
- Convert Recall transcript and lifecycle events into session runtime events.
- Queue responses and speak only at natural gaps.
- Normalize duplicate or out-of-order terminal events into one exact-once finalization path.

### 5.6 Gemini boundary

**Previous role:** speech provider with possible architectural overlap into reasoning paths.

**Target role:** speech layer only.

Refactor actions:

- Restrict Gemini usage to STT/TTS.
- Remove Gemini reasoning from the active runtime path.
- Remove Gemini tool-calling from the active runtime path.
- Ensure all agent decisions come from external `/assist` responses, not Gemini runtime inference.

### 5.7 Legacy modules to retire or isolate

Any module that does one of the following must be retired, reduced, or isolated behind the new runtime boundary:

- performs runtime reasoning locally,
- lets Gemini reason or call tools during live sessions,
- owns session state outside `VoiceSessionBuffer`,
- sends full transcript to `/assist`,
- allows multiple concurrent assist requests per session without stale-response suppression,
- finalizes sessions through provider-specific logic without shared exact-once safeguards.

If a legacy module cannot be deleted immediately, it must be placed behind a compatibility seam and prevented from becoming a parallel source of truth.

## 6. Core Runtime Contracts

### 6.1 Session state contract

```ts
type VoiceSessionBuffer = {
  sessionId: string;
  transcript: TranscriptTurn[];
  status: 'active' | 'ending' | 'ended';
  assist: {
    inFlight: boolean;
    activeTurnId?: string;
  };
  output: {
    queuedTts: TtsItem[];
  };
  provider: {
    twilio?: TwilioSessionState;
    recall?: RecallSessionState;
  };
  sessionEnd: {
    sent: boolean;
    acknowledged: boolean;
  };
};
```

Required behavior:

- One buffer per `session_id`
- Full transcript retained in memory until exact-once `/session-end` success
- No cross-session mutable state leakage
- Per-session queues, locks, and cleanup

### 6.2 `/assist` request contract

```json
{
  "session_id": "string",
  "turn_id": "string",
  "channel": "phone|meeting",
  "recent_turns": ["last 5-10 turns only"],
  "metadata": {}
}
```

Required behavior:

- Bearer authentication is required.
- Send only the last 5-10 turns.
- Never send the full transcript.
- Include `turn_id` or equivalent freshness token.

### 6.3 `/assist` response contract

```json
{
  "turn_id": "string",
  "say": "string",
  "should_end_session": false,
  "metadata": {}
}
```

### 6.4 Parse-at-boundary rule

`/assist` responses must be parsed and validated at the HTTP boundary.

If parsing or validation fails:

- do not admit the payload into session state,
- do not speak it,
- trigger immediate fallback behavior.

Example fallback:

```text
"Sorry, I had trouble with that. Please try again."
```

### 6.5 Assist concurrency and stale-response suppression

At most **one** assist request may be in flight per session.

Required behavior:

- Gate assist calls with a per-session lock or equivalent.
- Track the active `turn_id`.
- Suppress stale responses.
- Never speak a response if it no longer matches the session’s active turn.

Minimum rule:

```ts
if (response.turn_id !== session.assist.activeTurnId) {
  discard(response);
}
```

### 6.6 Ending-state behavior

Once a session enters `ending`, it must not resume normal interaction.

Required behavior:

- Ignore or cancel in-flight assist results.
- Drop queued unsaid TTS.
- Reject new non-terminal speech work.
- Prevent duplicate finalization.

## 7. Provider Contracts

### 7.1 Twilio contract

Endpoints:

```http
POST /twiml/{session_id}
WS   /media-stream/{session_id}
```

Required behavior:

- Session-specific TwiML generation
- Session-specific media websocket routing
- Immediate filler phrase while waiting on `/assist`
- Exact-once handling of websocket-close vs status-callback races

Suggested filler phrase:

```text
"One moment."
```

### 7.2 Recall contract

Required correlation:

```text
session_id <-> bot_id
```

Required behavior:

- Maintain direct session-to-bot mapping.
- Queue responses.
- Speak only at natural gaps.
- Handle duplicate and out-of-order terminal events exactly once.

## 8. `/session-end` Contract

`/session-end` is the authoritative handoff for the full transcript and terminal outcome.

### Request contract

```json
{
  "session_id": "string",
  "channel": "phone|meeting",
  "full_transcript": [],
  "ended_reason": "string",
  "metadata": {}
}
```

### Success semantics

Any **2xx** response counts as success.

An explicit idempotent duplicate acknowledgement may also be treated as success-equivalent if it is intentionally documented as safe.

Success examples:

- `200 OK`
- `202 Accepted`
- `204 No Content`
- explicit duplicate-already-processed acknowledgement that is safe to treat as success-equivalent

### Retention rule

Do not clear the full in-memory transcript until `/session-end` has succeeded exactly once or reached a safe success-equivalent duplicate acknowledgement path.

## 9. Migration and Cutover Plan

### 9.1 Migration objective

The repo must move from the previous bridge-oriented architecture to the new session-centric voice runtime without introducing regressions in active sessions, duplicate terminal handling, or provider callback behavior.

### 9.2 Migration approach

Recommended order:

1. Narrow the MCP surface to the two approved tools.
2. Introduce or finalize `VoiceSessionBuffer` as the canonical runtime state model.
3. Move `/assist` and `/session-end` into a dedicated authenticated HTTP client layer.
4. Restrict Gemini usage to STT/TTS only.
5. Refactor Twilio routing to session-specific `/twiml/{session_id}` and `/media-stream/{session_id}`.
6. Refactor Recall orchestration to the shared session model with `session_id <-> bot_id` correlation.
7. Remove or isolate legacy reasoning and bridge-only modules.
8. Enable exact-once finalization rules across both transports.

### 9.3 Compatibility mode and transitional concerns

During transition:

- Avoid dual sources of truth for session state.
- If compatibility wrappers exist, they must delegate into the new runtime core.
- Legacy modules may temporarily translate old events into new runtime events, but must not own final lifecycle decisions.
- Full transcript retention must already follow the new `/session-end` rule, even if some adapters are still mid-migration.
- Any old assist path must be blocked from sending the full transcript once the new contract is active.

### 9.4 Migration-time race and exact-once concerns

The riskiest migration failures are duplicate finalization, stale speech, and split session ownership.

Must-haves during cutover:

- one authoritative session object per `session_id`,
- one authoritative terminal finalization path,
- one authoritative assist lock per session,
- one authoritative stale-response check before speech,
- one authoritative cleanup gate after `/session-end` success.

If old and new adapters coexist briefly, terminal events from both must converge on the same idempotent finalizer.

## 10. Recommended Session Lifecycle

```text
1. MCP tool invoked with session_id
2. Runtime creates VoiceSessionBuffer
3. Twilio or Recall adapter attaches to that session
4. Gemini STT appends transcript turns
5. Runtime sends last 5-10 turns to /assist
6. Runtime validates /assist response at boundary
7. Runtime suppresses stale or malformed responses
8. Runtime queues or speaks only valid current output
9. Terminal event moves session to ending
10. Runtime drops queued unsaid TTS and ignores in-flight assist output
11. Runtime posts full transcript to /session-end
12. On 2xx or safe duplicate success-equivalent acknowledgement, finalize exactly once
```

## 11. Non-Negotiable Invariants

- `session_id` is the primary runtime key.
- The process is long-lived and enforces strict per-session isolation.
- `VoiceSessionBuffer` is the runtime source of truth.
- Gemini is limited to STT/TTS.
- `/assist` receives only the last 5-10 turns.
- Full transcript is never sent to `/assist`.
- Only one assist request is in flight per session.
- Stale assist responses are never spoken.
- Once `ending` begins, queued unsaid TTS is dropped.
- Once `ending` begins, in-flight assist results are ignored or canceled.
- Callback payloads are parsed and validated at the boundary.
- Malformed `/assist` responses trigger immediate fallback behavior.
- `/session-end` treats any 2xx as success.
- Safe explicit duplicate acknowledgement may be treated as success-equivalent.
- Session finalization is exact-once across transport race conditions.

## 12. Acceptance Checklist

### Refactor framing

- [ ] Engineers can identify the previous bridge-oriented architecture and the target session-centric runtime from this document alone.
- [ ] Removed, replaced, and retained architecture elements are explicitly reflected in implementation.
- [ ] Older docs and code comments that conflict with this target are updated or superseded.

### MCP layer

- [ ] Only `initiate_call(phone_number, session_id)` and `join_meeting(meeting_url, session_id)` remain as active MCP tools.
- [ ] Runtime-facing legacy MCP tools are removed, disabled, or isolated.
- [ ] `session_id` is mandatory at the MCP boundary.

### Runtime core and session model

- [ ] The Voice MCP server is implemented as the in-scope runtime component.
- [ ] The process is long-lived and enforces strict per-session isolation.
- [ ] Every session is keyed by `session_id`.
- [ ] `VoiceSessionBuffer` is the unified in-memory source of truth per session.
- [ ] The full transcript is retained until `/session-end` succeeds exactly once or reaches a safe success-equivalent duplicate acknowledgement path.

### Gemini boundary

- [ ] Gemini is used only for speech-to-text and text-to-speech.
- [ ] Gemini reasoning is removed from the active runtime path.
- [ ] Gemini tool-calling is removed from the active runtime path.

### External main-agent integration

- [ ] The external main agent is integrated only through authenticated `/assist` and `/session-end` calls.
- [ ] `/assist` uses bearer authentication.
- [ ] `/assist` receives only the last 5-10 turns.
- [ ] Full transcripts are never sent to `/assist`.
- [ ] No more than one `/assist` request is in flight per session.
- [ ] `turn_id` or equivalent freshness control is enforced.
- [ ] Stale `/assist` responses are discarded and never spoken.
- [ ] Malformed `/assist` responses are rejected at the boundary and trigger fallback behavior.

### Ending-state behavior

- [ ] Entering `ending` cancels or ignores in-flight assist results.
- [ ] Entering `ending` drops queued but unsaid TTS.
- [ ] Entering `ending` prevents resumed normal interaction.
- [ ] Terminal processing is idempotent.

### Twilio adapter

- [ ] `POST /twiml/{session_id}` is session-specific.
- [ ] `WS /media-stream/{session_id}` is session-specific.
- [ ] A filler phrase is spoken immediately while waiting on `/assist`.
- [ ] Websocket-close vs status-callback races are handled exactly once.

### Recall adapter

- [ ] `session_id <-> bot_id` correlation is stored and enforced.
- [ ] Recall events feed the shared runtime model.
- [ ] Responses are queued and spoken only at natural gaps.
- [ ] Duplicate or out-of-order terminal events are handled exactly once.

### `/session-end`

- [ ] `/session-end` uses bearer authentication.
- [ ] Any 2xx response is treated as success.
- [ ] Explicit safe duplicate acknowledgement can be treated as success-equivalent.
- [ ] Session cleanup happens only after `/session-end` success or success-equivalent acknowledgement.

### Migration and cutover

- [ ] Legacy reasoning and bridge-owned lifecycle paths are removed or isolated.
- [ ] No parallel source of truth remains for live session state.
- [ ] Migration wrappers, if any, delegate into the new runtime core rather than bypassing it.
- [ ] Exact-once finalization works during mixed old/new adapter transition.
- [ ] Stale-response suppression remains correct during migration.

## 13. Final Source-of-Truth Note

If any earlier plan, README, design note, or inline comment conflicts with this document, this document wins. The target architecture for the Voice MCP server is the session-centric runtime described here.

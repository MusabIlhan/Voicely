# Voisli

Voisli is a session-centric voice runtime with:

- phone transport via Twilio
- meeting transport via Recall
- speech I/O via Gemini
- main-agent integration via `/assist` and `/session-end`
- MCP access via local `stdio` and remote Streamable HTTP

## Core Processes

- Frontend: Next app
- Voice backend: Express server in [server/index.ts](/Users/karlo/hackathon2026/Voicely/server/index.ts)
- MCP `stdio` server: [server/mcp/index.ts](/Users/karlo/hackathon2026/Voicely/server/mcp/index.ts)
- MCP HTTP endpoint: `/mcp`, mounted by [server/app.ts](/Users/karlo/hackathon2026/Voicely/server/app.ts)

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend and backend together:

```bash
npm run dev
```

Run only the voice backend:

```bash
npm run dev:server
```

Run the local `stdio` MCP server:

```bash
npm run mcp
```

## MCP Docs

Use the dedicated guide for launch, deployment, and connection details:

- [docs/mcp-server.md](/Users/karlo/hackathon2026/Voicely/docs/mcp-server.md)

## Validation

```bash
npx tsc --noEmit
npm test
```

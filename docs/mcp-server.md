# MCP Server Guide

This document explains how Voisli's MCP server works, how to run it locally, how it behaves in deployment, and what URL to use for remote MCP clients.

## Architecture

Voisli now supports two MCP transports:

- Local `stdio` MCP server for process-spawned clients such as Claude Desktop and Claude Code
- Remote Streamable HTTP MCP endpoint for clients that connect to a hosted MCP URL

The relevant pieces are:

- `stdio` entrypoint: [server/mcp/index.ts](/Users/karlo/hackathon2026/Voicely/server/mcp/index.ts)
- Shared MCP server registration: [server/mcp/server.ts](/Users/karlo/hackathon2026/Voicely/server/mcp/server.ts)
- Remote HTTP transport: [server/mcp/http.ts](/Users/karlo/hackathon2026/Voicely/server/mcp/http.ts)
- Voice backend mounting `/mcp`: [server/app.ts](/Users/karlo/hackathon2026/Voicely/server/app.ts)

The MCP layer does not own voice session execution itself. It forwards tool/resource requests into the voice backend over HTTP using [server/mcp/bridge.ts](/Users/karlo/hackathon2026/Voicely/server/mcp/bridge.ts).

## Active Tools

The current active MCP tool surface is:

- `initiate_call(phone_number, session_id)`
- `join_meeting(meeting_url, session_id)`

Read-only resources remain available for status, calls, and meetings.

## Local Launch

Install dependencies:

```bash
npm install
```

Start the voice backend:

```bash
npm run dev:server
```

That starts the long-lived backend on `http://localhost:8080` by default.

If you want to run the local `stdio` MCP server directly:

```bash
npm run mcp
```

That process communicates over stdin/stdout and expects to reach the backend using `BRIDGE_SERVER_URL`.

## Local Claude Desktop / Claude Code Setup

For Claude Desktop or Claude Code, use the local `stdio` server. In that setup, Claude launches the MCP process automatically. You usually do not need to keep a manual `npm run mcp` terminal open.

Example config:

```json
{
  "mcpServers": {
    "voisli": {
      "command": "npx",
      "args": ["tsx", "server/mcp/index.ts"],
      "cwd": "/absolute/path/to/Voicely",
      "env": {
        "BRIDGE_SERVER_URL": "http://localhost:8080"
      }
    }
  }
}
```

Use cases:

- Claude Desktop
- Claude Code
- Any MCP client that launches a local process over `stdio`

## Remote MCP HTTP Endpoint

The voice backend now exposes a remote MCP endpoint at:

```text
<backend-base-url>/mcp
```

Examples:

- Local backend: `http://localhost:8080/mcp`
- Railway backend: `https://your-railway-service.up.railway.app/mcp`
- Custom backend domain: `https://voice.example.com/mcp`

This endpoint uses Streamable HTTP transport.

Use cases:

- Lovable, if it supports remote MCP by URL
- Any MCP client that asks for a hosted MCP server URL
- Remote integrations that should not spawn a local process

If a client asks for transport type, use `Streamable HTTP` and the `/mcp` URL above.

## Deployment Behavior

### Railway backend

The backend deployment in [railway.json](/Users/karlo/hackathon2026/Voicely/railway.json) starts:

```bash
npm run start:bridge
```

That means the deployed backend automatically serves:

- the voice backend routes
- Twilio and Recall webhooks
- the remote MCP endpoint at `/mcp`

It does not start the local `stdio` MCP server, because that is a separate CLI process intended for local process-spawned clients.

### Vercel frontend

If your frontend is deployed on Vercel and your backend is deployed separately, the Vercel deployment does not launch the `stdio` MCP server and does not replace the backend process.

In that common split deployment:

- frontend lives on Vercel
- voice backend lives on Railway, Render, Fly.io, or another long-lived backend host
- MCP URL is the backend URL plus `/mcp`

Example:

- frontend: `https://app.example.com`
- backend: `https://voice.example.com`
- MCP URL: `https://voice.example.com/mcp`

### Full backend on Vercel

This repo's voice backend is designed as a long-lived server process with WebSocket/media streaming behavior. That is not the natural fit for a pure serverless Vercel deployment.

For production, treat the backend and the remote MCP endpoint as backend-hosted infrastructure, not as a frontend-only Vercel function by default.

## Which URL Should You Use?

Use the URL based on the client type:

- Claude Desktop / Claude Code: no MCP URL is needed; use the local `stdio` config
- Remote MCP client: use `https://<your-backend-domain>/mcp`
- Local remote-client testing: use `http://localhost:8080/mcp`

## Environment Variables

Relevant environment variables from [.env.example](/Users/karlo/hackathon2026/Voicely/.env.example):

- `BRIDGE_SERVER_PORT`
- `BRIDGE_SERVER_HOST`
- `PUBLIC_SERVER_URL`
- `NEXT_PUBLIC_BRIDGE_SERVER_URL`
- `BRIDGE_SERVER_URL`

Typical meanings:

- `BRIDGE_SERVER_HOST` and `BRIDGE_SERVER_PORT` control where the backend listens
- `PUBLIC_SERVER_URL` is the public backend URL Twilio can reach
- `NEXT_PUBLIC_BRIDGE_SERVER_URL` is what the frontend uses to call the backend
- `BRIDGE_SERVER_URL` is what the local `stdio` MCP process uses to call the backend

For local development, the defaults are usually enough.

For deployment, set:

```env
PUBLIC_SERVER_URL=https://voice.example.com
NEXT_PUBLIC_BRIDGE_SERVER_URL=https://voice.example.com
BRIDGE_SERVER_URL=https://voice.example.com
```

## Health And Discovery

`GET /status` includes MCP metadata from [server/app.ts](/Users/karlo/hackathon2026/Voicely/server/app.ts), including the remote MCP URL when the backend is running.

Example:

```json
{
  "mcp": {
    "configured": true,
    "tools": 2,
    "resources": 5,
    "transports": ["stdio", "streamable_http"],
    "url": "https://voice.example.com/mcp"
  }
}
```

## Verification

Local validation commands:

```bash
npx tsc --noEmit
npm test
```

## Troubleshooting

### Claude can start the MCP server but tool calls fail

Check that the backend is running and that `BRIDGE_SERVER_URL` points to it.

### Remote MCP client cannot connect

Check:

- the backend is publicly reachable
- the client is using `<backend-base-url>/mcp`
- the backend host, proxy, or CDN allows `GET`, `POST`, `DELETE`, and SSE-compatible responses

### Twilio works locally but not in deployment

Check:

- `PUBLIC_SERVER_URL`
- Twilio webhook configuration
- the backend is the public host, not just the frontend

### Vercel app is up but MCP URL does not work

That usually means only the frontend is deployed. The MCP endpoint lives on the voice backend host, not automatically on the frontend deployment.

import express from "express";
import { createServer } from "http";
import type { IncomingMessage } from "http";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";
import { config, validateConfig, isConfigured } from "./config";
import twilioWebhooks from "./twilio/webhooks";
import recallWebhooks from "./meeting/webhooks";
import { callManager } from "./callManager";
import { initiateOutboundCall } from "./twilio/outbound";
import { meetingOrchestrator } from "./meeting/meetingOrchestrator";
import { outputMediaHub } from "./meeting/outputMediaHub";
import type { BridgeServerStatus } from "../shared/types";
import { sseHandler } from "./events";

const startTime = Date.now();

const app = express();

function summarizeUpgradeRequest(req: IncomingMessage) {
  return {
    method: req.method,
    url: req.url,
    host: req.headers.host,
    origin: req.headers.origin ?? "none",
    userAgent: req.headers["user-agent"] ?? "unknown",
    upgrade: req.headers.upgrade ?? "none",
    connection: req.headers.connection ?? "none",
    secWebSocketVersion: req.headers["sec-websocket-version"] ?? "none",
    secWebSocketExtensions: req.headers["sec-websocket-extensions"] ?? "none",
    secWebSocketProtocol: req.headers["sec-websocket-protocol"] ?? "none",
    xForwardedFor: req.headers["x-forwarded-for"] ?? "none",
  };
}

function getUpgradePath(req: IncomingMessage): string {
  return new URL(req.url ?? "/", "http://localhost").pathname;
}

function getBotIdFromUpgradeRequest(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  const botId = url.searchParams.get("botId");
  return botId && botId.trim().length > 0 ? botId : null;
}

// Parse request bodies for Twilio webhooks
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((req, res, next) => {
  if (req.path.startsWith("/twiml") || req.path === "/call-status") {
    console.log(
      `[HTTP] ${req.method} ${req.path} query=${JSON.stringify(req.query)} bodyKeys=${Object.keys(req.body ?? {}).join(",") || "none"}`,
    );
  }

  res.on("finish", () => {
    if (req.path.startsWith("/twiml") || req.path === "/call-status") {
      console.log(
        `[HTTP] ${req.method} ${req.path} -> ${res.statusCode} contentType=${res.getHeader("content-type") ?? "none"}`,
      );
    }
  });

  next();
});

// CORS for Next.js dashboard
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Mount Twilio webhook routes
app.use(twilioWebhooks);

// Mount Recall.ai webhook routes
app.use(recallWebhooks);

// SSE endpoint for real-time dashboard updates
app.get("/events", sseHandler);

app.get("/output-media/:botId", (req, res) => {
  res.type("html").send(outputMediaHub.renderPage(req.params.botId));
});

// Status endpoint for the dashboard
app.get("/status", (_req, res) => {
  const services = isConfigured();
  const mcpConfigured = !!process.env.BRIDGE_SERVER_URL || true; // MCP server can always connect to bridge
  const status: BridgeServerStatus = {
    activeCalls: callManager.getCallCount(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    configuredServices: services,
    mcp: {
      configured: mcpConfigured,
      tools: 8,
      resources: 5,
    },
  };
  res.json(status);
});

// Call management endpoints

// GET /calls — returns list of all calls (active and recent) with metadata
app.get("/calls", (_req, res) => {
  const calls = callManager.getAllCalls();
  res.json({ calls });
});

// POST /calls/outbound — manually initiate an outbound call (for testing)
app.post("/calls/outbound", async (req, res) => {
  const { toNumber, purpose } = req.body ?? {};

  if (!toNumber || typeof toNumber !== "string") {
    res.status(400).json({ error: "toNumber is required and must be a string" });
    return;
  }

  if (!purpose || typeof purpose !== "string") {
    res.status(400).json({ error: "purpose is required and must be a string" });
    return;
  }

  const result = await initiateOutboundCall(toNumber, purpose);
  res.status(result.success ? 200 : 500).json(result);
});

// GET /calls/:callSid — get details of a specific call
app.get("/calls/:callSid", (req, res) => {
  const call = callManager.getCallBySid(req.params.callSid);
  if (!call) {
    res.status(404).json({ error: "Call not found" });
    return;
  }
  res.json({ call });
});

// Meeting management endpoints

// POST /meetings/join — create a Recall.ai bot and send it to a meeting
app.post("/meetings/join", async (req, res) => {
  const { meetingUrl, botName } = req.body ?? {};

  if (!meetingUrl || typeof meetingUrl !== "string") {
    res
      .status(400)
      .json({ error: "meetingUrl is required and must be a string" });
    return;
  }

  try {
    const session = await meetingOrchestrator.joinMeeting(meetingUrl, botName);
    res.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Bridge] Failed to join meeting: ${message}`);
    res.status(500).json({ error: message });
  }
});

// GET /meetings — list all meeting sessions (active and past)
app.get("/meetings", (_req, res) => {
  const sessions = meetingOrchestrator.getAllSessions();
  res.json({ sessions });
});

// GET /meetings/:botId — get details of a specific meeting session
app.get("/meetings/:botId", (req, res) => {
  const session = meetingOrchestrator.getSession(req.params.botId);
  if (!session) {
    res.status(404).json({ error: "Meeting session not found" });
    return;
  }
  res.json({ session });
});

// POST /meetings/:botId/leave — remove bot from the meeting
app.post("/meetings/:botId/leave", async (req, res) => {
  try {
    await meetingOrchestrator.leaveMeeting(req.params.botId);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: message });
  }
});

// GET /meetings/:botId/summary — get AI-generated meeting summary
app.get("/meetings/:botId/summary", (req, res) => {
  const session = meetingOrchestrator.getSession(req.params.botId);
  if (!session) {
    res.status(404).json({ error: "Meeting session not found" });
    return;
  }
  const summary = meetingOrchestrator.getSummary(req.params.botId);
  res.json({ botId: req.params.botId, summary });
});

// GET /meetings/:botId/transcript — get full transcript
app.get("/meetings/:botId/transcript", (req, res) => {
  const session = meetingOrchestrator.getSession(req.params.botId);
  if (!session) {
    res.status(404).json({ error: "Meeting session not found" });
    return;
  }
  const transcript = meetingOrchestrator.getTranscript(req.params.botId);
  res.json({ botId: req.params.botId, transcript });
});

// Create HTTP server and WebSocket server
const server = createServer(app);

server.on("upgrade", (req, socket, head) => {
  console.log(`[Upgrade] ${JSON.stringify(summarizeUpgradeRequest(req))}`);

  const pathname = getUpgradePath(req);

  if (pathname === "/media-stream") {
    wssInbound.handleUpgrade(req, socket, head, (ws) => {
      wssInbound.emit("headers", [], req);
      wssInbound.emit("connection", ws, req);
    });
    return;
  }

  if (pathname === "/media-stream-outbound") {
    wssOutbound.handleUpgrade(req, socket, head, (ws) => {
      wssOutbound.emit("headers", [], req);
      wssOutbound.emit("connection", ws, req);
    });
    return;
  }

  if (pathname === "/webhooks/recall/realtime") {
    wssRecallRealtime.handleUpgrade(req, socket, head, (ws) => {
      wssRecallRealtime.emit("headers", [], req);
      wssRecallRealtime.emit("connection", ws, req);
    });
    return;
  }

  if (pathname === "/output-media/ws") {
    wssOutputMedia.handleUpgrade(req, socket, head, (ws) => {
      wssOutputMedia.emit("headers", [], req);
      wssOutputMedia.emit("connection", ws, req);
    });
    return;
  }

  socket.destroy();
});

// Inbound call media stream
const wssInbound = new WebSocketServer({
  noServer: true,
  perMessageDeflate: false,
});

wssInbound.on("connection", (ws) => {
  console.log("[Bridge] New inbound WebSocket connection on /media-stream");
  const orchestrator = callManager.handleNewCall(ws, { direction: "inbound", context: "inbound" });

  orchestrator.on("error", (err) => {
    console.error(`[Bridge] Inbound call error: ${err.message}`);
  });
});

// Outbound call media stream
const wssOutbound = new WebSocketServer({
  noServer: true,
  perMessageDeflate: false,
});

const wssRecallRealtime = new WebSocketServer({
  noServer: true,
  perMessageDeflate: false,
});

const wssOutputMedia = new WebSocketServer({
  noServer: true,
  perMessageDeflate: false,
});

wssInbound.on("headers", (_headers, req) => {
  console.log(
    `[Bridge] Inbound upgrade accepted path=/media-stream request=${JSON.stringify(summarizeUpgradeRequest(req))}`,
  );
});

wssOutbound.on("connection", (ws, req) => {
  console.log(
    `[Bridge] New outbound WebSocket connection on /media-stream-outbound remote=${req.socket.remoteAddress ?? "unknown"} extensions=${ws.extensions || "none"}`,
  );

  // Twilio sends the custom parameters in the 'start' message.
  // We need to listen for the first message to extract them, then hand off.
  // The CallOrchestrator constructor wires up all listeners immediately,
  // but we need the purpose before construction. We'll parse the first
  // message ourselves then pass it.
  let initialized = false;

  ws.on("message", function onFirstMessage(data) {
    if (initialized) return;

    try {
      console.log(`[Bridge] Outbound first message bytes=${data.toString().length}`);
      const msg = JSON.parse(data.toString());
      if (msg.event === "start") {
        initialized = true;
        ws.removeListener("message", onFirstMessage);

        const params = msg.start?.customParameters ?? {};
        const purpose = params.purpose ?? "";
        const isReservation = purpose.toLowerCase().includes("reserv");
        const context = isReservation ? "outbound_reservation" as const : "outbound_generic" as const;

        // Re-emit this start message so the TwilioMediaStream also processes it
        // We need to re-inject it. The simplest approach: create orchestrator
        // then replay the message.
        const orchestrator = callManager.handleNewCall(ws, {
          direction: "outbound",
          context,
          purpose,
        });

        orchestrator.on("error", (err) => {
          console.error(`[Bridge] Outbound call error: ${err.message}`);
        });

        // Replay the start message for the TwilioMediaStream handler
        console.log("[Bridge] Replaying outbound Twilio start message into orchestrator");
        ws.emit("message", data);
      }
    } catch {
      // Not a valid JSON message yet, ignore
    }
  });
});

wssOutbound.on("headers", (_headers, req) => {
  console.log(
    `[Bridge] Outbound upgrade accepted path=/media-stream-outbound request=${JSON.stringify(summarizeUpgradeRequest(req))}`,
  );
});

wssRecallRealtime.on("headers", (_headers, req) => {
  console.log(
    `[Bridge] Recall realtime upgrade accepted path=/webhooks/recall/realtime request=${JSON.stringify(summarizeUpgradeRequest(req))}`,
  );
});

wssOutputMedia.on("headers", (_headers, req) => {
  console.log(
    `[Bridge] Output media upgrade accepted path=/output-media/ws request=${JSON.stringify(summarizeUpgradeRequest(req))}`,
  );
});

wssRecallRealtime.on("connection", (ws: WebSocket, req) => {
  console.log(
    `[Bridge] New Recall realtime WebSocket connection remote=${req.socket.remoteAddress ?? "unknown"} extensions=${ws.extensions || "none"}`,
  );

  ws.on("message", (rawData) => {
    try {
      const event = JSON.parse(rawData.toString());
      meetingOrchestrator.handleRealtimeEvent(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Bridge] Failed to parse Recall realtime message: ${message}`);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(
      `[Bridge] Recall realtime WebSocket closed code=${code} reason=${reason.toString() || "none"}`,
    );
  });

  ws.on("error", (err) => {
    console.error(`[Bridge] Recall realtime WebSocket error: ${err.message}`);
  });
});

wssOutputMedia.on("connection", (ws: WebSocket, req) => {
  const requestedBotId = getBotIdFromUpgradeRequest(req);
  const botId = requestedBotId ? outputMediaHub.resolveBotId(requestedBotId) : null;
  if (!botId) {
    console.warn("[Bridge] Rejecting output media WebSocket without resolvable botId");
    ws.close(1008, "missing_bot_id");
    return;
  }

  outputMediaHub.addClient(botId, ws);
  meetingOrchestrator.handleOutputMediaConnection(botId, true);

  console.log(
    `[Bridge] Output media WebSocket connected for bot ${botId} remote=${req.socket.remoteAddress ?? "unknown"} clients=${outputMediaHub.clientCount(botId)}`,
  );

  ws.on("close", (code, reason) => {
    meetingOrchestrator.handleOutputMediaConnection(botId, outputMediaHub.hasClients(botId));
    console.log(
      `[Bridge] Output media WebSocket closed for bot ${botId} code=${code} reason=${reason.toString() || "none"} remainingClients=${outputMediaHub.clientCount(botId)}`,
    );
  });

  ws.on("error", (err) => {
    console.error(`[Bridge] Output media WebSocket error for bot ${botId}: ${err.message}`);
  });
});

// Start the server
const { port, host } = config.server;

server.listen(port, host, () => {
  console.log(`\n========================================`);
  console.log(`  Voisli Bridge Server`);
  console.log(`  Listening on http://${host}:${port}`);
  console.log(`========================================`);

  validateConfig();

  const services = isConfigured();
  console.log(`\n  Services:`);
  console.log(`    Twilio:    ${services.twilio ? "✓ configured" : "✗ not configured"}`);
  console.log(`    Gemini:    ${services.gemini ? "✓ configured" : "✗ not configured"}`);
  console.log(`    Calendar:  ${services.googleCalendar ? "✓ configured" : "✗ not configured"}`);
  console.log(`    Recall.ai: ${services.recall ? "✓ configured" : "✗ not configured"}`);

  if (config.server.publicUrl && !config.server.publicUrl.startsWith("https://your-")) {
    console.log(`\n  Public URL: ${config.server.publicUrl}`);
    console.log(`  TwiML webhook: ${config.server.publicUrl}/twiml`);
  } else {
    console.log(`\n  ⚠ No PUBLIC_SERVER_URL set — configure ngrok for Twilio webhooks`);
  }

  console.log(`\n  Status API: http://${host}:${port}/status`);
  console.log(`  WebSocket:  ws://${host}:${port}/media-stream`);
  console.log(``);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n[Bridge] Received ${signal}, shutting down...`);
  callManager.closeAll();
  wssInbound.close(() => {
    wssOutbound.close(() => {
      wssRecallRealtime.close(() => {
        server.close(() => {
          console.log("[Bridge] Server closed");
          process.exit(0);
        });
      });
    });
  });
  // Force exit after 5 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error("[Bridge] Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

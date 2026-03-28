import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { config, validateConfig, isConfigured } from "./config";
import twilioWebhooks from "./twilio/webhooks";
import recallWebhooks from "./meeting/webhooks";
import { callManager } from "./callManager";
import { initiateOutboundCall } from "./twilio/outbound";
import { meetingOrchestrator } from "./meeting/meetingOrchestrator";
import type { BridgeServerStatus } from "../shared/types";
import { sseHandler } from "./events";
import { runHealthCheck } from "./health";
import authRoutes from "./auth";

const startTime = Date.now();

const app = express();

// Parse request bodies for Twilio webhooks
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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

// Mount auth routes
app.use(authRoutes);

// Mount Twilio webhook routes
app.use(twilioWebhooks);

// Mount Recall.ai webhook routes
app.use(recallWebhooks);

// SSE endpoint for real-time dashboard updates
app.get("/events", sseHandler);

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
    twilioNumber: config.twilio.phoneNumber || undefined,
    publicServerUrl: config.server.publicUrl || undefined,
  };
  res.json(status);
});

// Health check endpoint — tests connectivity to all external services
app.get("/health", async (_req, res) => {
  try {
    const health = await runHealthCheck();
    const httpStatus = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
    res.status(httpStatus).json(health);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Bridge] Health check failed: ${message}`);
    res.status(500).json({
      status: "down",
      error: "Health check failed unexpectedly",
      timestamp: new Date().toISOString(),
    });
  }
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

// Global error handler middleware — catches unhandled errors in route handlers
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[Bridge] Unhandled error: ${err.message}`, err.stack);
  if (!res.headersSent) {
    res.status(500).json({
      error: "An internal server error occurred",
      message: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

// Create HTTP server and WebSocket server
const server = createServer(app);

// WebSocket servers — noServer mode to avoid Express 5 intercepting upgrades
const wssInbound = new WebSocketServer({ noServer: true });
const wssOutbound = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url ?? "", `http://${request.headers.host}`);

  if (pathname === "/media-stream") {
    wssInbound.handleUpgrade(request, socket, head, (ws) => {
      wssInbound.emit("connection", ws, request);
    });
  } else if (pathname === "/media-stream-outbound") {
    wssOutbound.handleUpgrade(request, socket, head, (ws) => {
      wssOutbound.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wssInbound.on("connection", (ws) => {
  console.log("[Bridge] New inbound WebSocket connection on /media-stream");
  const orchestrator = callManager.handleNewCall(ws, { direction: "inbound", context: "inbound" });

  orchestrator.on("error", (err) => {
    console.error(`[Bridge] Inbound call error: ${err.message}`);
  });
});

wssOutbound.on("connection", (ws) => {
  console.log("[Bridge] New outbound WebSocket connection on /media-stream-outbound");

  // Twilio sends the custom parameters in the 'start' message.
  // We need to listen for the first message to extract them, then hand off.
  // The CallOrchestrator constructor wires up all listeners immediately,
  // but we need the purpose before construction. We'll parse the first
  // message ourselves then pass it.
  let initialized = false;

  ws.on("message", function onFirstMessage(data) {
    if (initialized) return;

    try {
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
        ws.emit("message", data);
      }
    } catch {
      // Not a valid JSON message yet, ignore
    }
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
      server.close(() => {
        console.log("[Bridge] Server closed");
        process.exit(0);
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

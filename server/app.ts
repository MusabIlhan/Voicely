import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { createServer, type Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { URL } from "url";
import { config, isConfigured } from "./config.js";
import { sseHandler } from "./events.js";
import { runHealthCheck } from "./health.js";
import authRoutes from "./auth.js";
import { clearKnowledgeCache, loadKnowledgeBase, saveKnowledgeBase, type KnowledgeBase } from "./knowledge/index.js";
import recallWebhooks from "./meeting/webhooks.js";
import twilioWebhooks from "./twilio/webhooks.js";
import { initiateOutboundCall } from "./twilio/outbound.js";
import { TwilioMediaStream } from "./twilio/mediaStream.js";
import {
  buildMeetingSummary,
  projectCallSession,
  projectMeetingSession,
  projectTranscriptEntries,
} from "./voice/compatibility.js";
import { voiceCoordinator } from "./voice/voiceCoordinator.js";

function createSessionId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function listCallSnapshots() {
  return voiceCoordinator
    .getAllSessionSnapshots()
    .filter((session) => session.channel === "phone")
    .map(projectCallSession)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function listMeetingSnapshots() {
  return voiceCoordinator
    .getAllSessionSnapshots()
    .filter((session) => session.channel === "meeting")
    .map(projectMeetingSession)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function resolveMeetingSnapshot(id: string) {
  const liveBySessionId = voiceCoordinator.getSession(id);
  if (liveBySessionId?.channel === "meeting") {
    return liveBySessionId;
  }

  return voiceCoordinator.getSessionSnapshotByBotId(id);
}

export function createApp() {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

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

  app.use(authRoutes);
  app.use(twilioWebhooks);
  app.use(recallWebhooks);

  app.get("/events", sseHandler);

  app.get("/status", (_req, res) => {
    const sessions = voiceCoordinator.getAllSessions();
    const configured = isConfigured();
    res.json({
      uptime: Math.floor(process.uptime()),
      activeSessions: sessions.filter((session) => session.status === "active").length,
      activeCalls: sessions.filter((session) => session.channel === "phone" && session.status === "active").length,
      activeMeetings: sessions.filter((session) => session.channel === "meeting" && session.status === "active").length,
      mcp: {
        configured: true,
        tools: 2,
        resources: 5,
      },
      configuredServices: {
        twilio: configured.twilio,
        gemini: configured.gemini,
        calendar: configured.googleCalendar,
        recall: configured.recall,
      },
      twilioNumber: config.twilio.phoneNumber || undefined,
      publicServerUrl: config.server.publicUrl || undefined,
    });
  });

  app.get("/health", async (_req, res) => {
    const health = await runHealthCheck();
    res.status(health.status === "down" ? 503 : 200).json(health);
  });

  app.post("/calls/initiate", async (req, res) => {
    const { phoneNumber, sessionId, purpose } = req.body ?? {};
    if (typeof phoneNumber !== "string" || phoneNumber.length === 0) {
      res.status(400).json({ error: "phoneNumber is required and must be a string" });
      return;
    }

    if (typeof sessionId !== "string" || sessionId.length === 0) {
      res.status(400).json({ error: "sessionId is required and must be a string" });
      return;
    }

    voiceCoordinator.createPhoneSession(sessionId, phoneNumber, {
      purpose: typeof purpose === "string" ? purpose : undefined,
    });

    const result = await initiateOutboundCall(phoneNumber, sessionId);
    if (!result.success) {
      await voiceCoordinator.handleTwilioTerminalEvent(sessionId, "twilio_initiation_failed");
      res.status(500).json({ ...result, session_id: sessionId });
      return;
    }

    res.json({ status: "dialling", session_id: sessionId, call_sid: result.callSid });
  });

  app.post("/calls/outbound", async (req, res) => {
    const phoneNumber =
      typeof req.body?.toNumber === "string"
        ? req.body.toNumber
        : typeof req.body?.phoneNumber === "string"
          ? req.body.phoneNumber
          : undefined;
    const purpose = typeof req.body?.purpose === "string" ? req.body.purpose : undefined;
    const sessionId =
      typeof req.body?.sessionId === "string" && req.body.sessionId.length > 0
        ? req.body.sessionId
        : createSessionId("call");

    if (!phoneNumber || phoneNumber.length === 0) {
      res.status(400).json({ error: "toNumber or phoneNumber is required and must be a string" });
      return;
    }

    voiceCoordinator.createPhoneSession(sessionId, phoneNumber, { purpose });

    const result = await initiateOutboundCall(phoneNumber, sessionId);
    if (!result.success) {
      await voiceCoordinator.handleTwilioTerminalEvent(sessionId, "twilio_initiation_failed");
      res.status(500).json({ ...result, session_id: sessionId });
      return;
    }

    res.json({
      ...result,
      status: "dialling",
      session_id: sessionId,
    });
  });

  app.get("/calls", (_req, res) => {
    res.json({ calls: listCallSnapshots() });
  });

  app.post("/meetings/join", async (req, res) => {
    const { meetingUrl, sessionId: requestedSessionId, botName } = req.body ?? {};
    if (typeof meetingUrl !== "string" || meetingUrl.length === 0) {
      res.status(400).json({ error: "meetingUrl is required and must be a string" });
      return;
    }

    const sessionId =
      typeof requestedSessionId === "string" && requestedSessionId.length > 0
        ? requestedSessionId
        : createSessionId("meeting");

    const { botId } = await voiceCoordinator.createMeetingSession(
      sessionId,
      meetingUrl,
      typeof botName === "string" && botName.length > 0 ? botName : undefined
    );

    res.json({
      status: "joining",
      session_id: sessionId,
      bot_id: botId,
      meeting_url: meetingUrl,
    });
  });

  app.get("/meetings", (_req, res) => {
    res.json({ sessions: listMeetingSnapshots() });
  });

  app.get("/meetings/:botId", (req, res) => {
    const session = resolveMeetingSnapshot(req.params.botId);
    if (!session) {
      res.status(404).json({ error: "Meeting session not found" });
      return;
    }

    res.json({ session: projectMeetingSession(session) });
  });

  app.get("/meetings/:botId/transcript", (req, res) => {
    const session = resolveMeetingSnapshot(req.params.botId);
    if (!session) {
      res.status(404).json({ error: "Meeting session not found" });
      return;
    }

    res.json({ transcript: projectTranscriptEntries(session) });
  });

  app.get("/meetings/:botId/summary", (req, res) => {
    const session = resolveMeetingSnapshot(req.params.botId);
    if (!session) {
      res.status(404).json({ error: "Meeting session not found" });
      return;
    }

    res.json({ summary: buildMeetingSummary(session) });
  });

  app.post("/meetings/:botId/leave", async (req, res) => {
    const directSession = voiceCoordinator.getSession(req.params.botId);
    const sessionId =
      directSession?.channel === "meeting"
        ? directSession.sessionId
        : voiceCoordinator.getSessionIdByBotId(req.params.botId);

    if (!sessionId) {
      res.status(404).json({ error: "Meeting session not found" });
      return;
    }

    try {
      await voiceCoordinator.leaveMeeting(sessionId);
      res.json({ success: true });
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/knowledge", (_req, res) => {
    try {
      clearKnowledgeCache();
      const kb = loadKnowledgeBase();
      res.json(kb);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/knowledge", (req, res) => {
    const kb = req.body as KnowledgeBase;
    if (!kb || !kb.company || !kb.products) {
      res.status(400).json({ error: "Invalid knowledge base format. Requires company and products." });
      return;
    }

    try {
      saveKnowledgeBase(kb);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/sessions", (_req, res) => {
    res.json({ sessions: voiceCoordinator.getAllSessions() });
  });

  app.get("/sessions/:sessionId", (req, res) => {
    const session = voiceCoordinator.getSessionSnapshot(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({ session });
  });

  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    void next;
    console.error("[VoiceServer] Unhandled error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "An internal server error occurred" });
    }
  });

  return app;
}

export function attachVoiceWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const match = url.pathname.match(/^\/media-stream\/([^/]+)$/);
    if (!match) {
      socket.destroy();
      return;
    }

    const sessionId = decodeURIComponent(match[1]);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, sessionId);
    });
  });

  wss.on("connection", (ws: WebSocket, _request: IncomingMessage, sessionId: string) => {
    const mediaStream = new TwilioMediaStream(ws);
    voiceCoordinator.attachTwilioTransport(sessionId, mediaStream);
  });
}

export function createHttpServer(): HttpServer {
  const app = createApp();
  const server = createServer(app);
  attachVoiceWebSocketServer(server);
  return server;
}

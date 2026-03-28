import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createVoisliMcpServer } from "./server.js";

type McpHttpSession = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

const sessions = new Map<string, McpHttpSession>();

function resolveSessionId(req: Request): string | undefined {
  const sessionId = req.header("mcp-session-id");
  if (!sessionId) {
    return undefined;
  }

  const trimmed = sessionId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function containsInitializeRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((message) => isInitializeRequest(message));
  }

  return isInitializeRequest(body);
}

function sendJsonRpcError(
  res: Response,
  status: number,
  code: number,
  message: string
): void {
  res.status(status).json({
    jsonrpc: "2.0",
    error: {
      code,
      message,
    },
    id: null,
  });
}

async function closeSession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  sessions.delete(sessionId);
  await session.server.close();
}

async function createSession(): Promise<McpHttpSession> {
  const server = createVoisliMcpServer();
  let sessionRef: McpHttpSession | undefined;

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (sessionId) => {
      if (!sessionRef) {
        return;
      }

      sessions.set(sessionId, sessionRef);
    },
    onsessionclosed: async (sessionId) => {
      await closeSession(sessionId);
    },
  });

  transport.onclose = () => {
    void closeSession(transport.sessionId);
  };

  transport.onerror = (error) => {
    console.error("[MCP HTTP] Transport error:", error);
  };

  await server.connect(transport);

  sessionRef = { server, transport };
  return sessionRef;
}

async function handlePost(req: Request, res: Response): Promise<void> {
  const sessionId = resolveSessionId(req);

  try {
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        sendJsonRpcError(res, 404, -32001, "Session not found");
        return;
      }

      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (!containsInitializeRequest(req.body)) {
      sendJsonRpcError(res, 400, -32000, "Bad Request: No valid session ID provided");
      return;
    }

    const session = await createSession();
    await session.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[MCP HTTP] Failed to handle POST request:", error);
    if (!res.headersSent) {
      sendJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }
}

async function handleGet(req: Request, res: Response): Promise<void> {
  const sessionId = resolveSessionId(req);
  if (!sessionId) {
    sendJsonRpcError(res, 400, -32000, "Invalid or missing session ID");
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sendJsonRpcError(res, 404, -32001, "Session not found");
    return;
  }

  try {
    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error("[MCP HTTP] Failed to handle GET request:", error);
    if (!res.headersSent) {
      sendJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }
}

async function handleDelete(req: Request, res: Response): Promise<void> {
  const sessionId = resolveSessionId(req);
  if (!sessionId) {
    sendJsonRpcError(res, 400, -32000, "Invalid or missing session ID");
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sendJsonRpcError(res, 404, -32001, "Session not found");
    return;
  }

  try {
    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error("[MCP HTTP] Failed to handle DELETE request:", error);
    if (!res.headersSent) {
      sendJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }
}

export function registerMcpHttpRoutes(app: Express): void {
  app.post("/mcp", (req, res) => {
    void handlePost(req, res);
  });

  app.get("/mcp", (req, res) => {
    void handleGet(req, res);
  });

  app.delete("/mcp", (req, res) => {
    void handleDelete(req, res);
  });
}

export async function closeAllMcpHttpSessions(): Promise<void> {
  const sessionIds = [...sessions.keys()];
  await Promise.all(sessionIds.map((sessionId) => closeSession(sessionId)));
}

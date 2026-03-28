import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";

const mockState = vi.hoisted(() => {
  const createdServers: Array<{
    connect: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }> = [];
  const createdTransports: MockTransport[] = [];

  class MockTransport {
    sessionId?: string;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    handledRequests: Array<{ method: string; body?: unknown }> = [];

    constructor(
      private readonly options: {
        onsessioninitialized?: (sessionId: string) => void | Promise<void>;
        onsessionclosed?: (sessionId: string) => void | Promise<void>;
      } = {}
    ) {
      createdTransports.push(this);
    }

    async handleRequest(req: Request, res: Response, body?: unknown): Promise<void> {
      this.handledRequests.push({ method: req.method, body });

      if (req.method === "DELETE") {
        if (this.sessionId) {
          await this.options.onsessionclosed?.(this.sessionId);
        }
        res.sendStatus(204);
        this.onclose?.();
        return;
      }

      const message = Array.isArray(body) ? body[0] : body;
      const method = typeof message === "object" && message !== null ? (message as { method?: string }).method : undefined;

      if (method === "initialize") {
        this.sessionId = this.sessionId ?? `session-${createdTransports.length}`;
        await this.options.onsessioninitialized?.(this.sessionId);
        res.setHeader("mcp-session-id", this.sessionId);
        res.status(200).json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2025-03-26",
            serverInfo: {
              name: "voisli",
            },
          },
        });
        return;
      }

      if (method === "tools/list") {
        res.status(200).json({
          jsonrpc: "2.0",
          id: 2,
          result: {
            tools: [
              { name: "initiate_call" },
              { name: "join_meeting" },
            ],
          },
        });
        return;
      }

      if (method === "resources/list") {
        res.status(200).json({
          jsonrpc: "2.0",
          id: 3,
          result: {
            resources: [
              { uri: "voisli://status" },
              { uri: "voisli://calls/active" },
              { uri: "voisli://calls/recent" },
              { uri: "voisli://meetings/active" },
              { uri: "voisli://meetings/recent" },
            ],
          },
        });
        return;
      }

      res.sendStatus(202);
    }
  }

  return {
    createdServers,
    createdTransports,
    MockTransport,
  };
});

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: mockState.MockTransport,
}));

vi.mock("./server.js", () => ({
  createVoisliMcpServer: vi.fn(() => {
    const server = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockState.createdServers.push(server);
    return server;
  }),
}));

import { closeAllMcpHttpSessions, registerMcpHttpRoutes } from "./http.js";

type RouteHandler = (req: Request, res: Response) => void;

function createCapturedApp() {
  const routes = new Map<string, RouteHandler>();
  const app = {
    post: vi.fn((path: string, handler: RouteHandler) => {
      routes.set(`POST ${path}`, handler);
      return app;
    }),
    get: vi.fn((path: string, handler: RouteHandler) => {
      routes.set(`GET ${path}`, handler);
      return app;
    }),
    delete: vi.fn((path: string, handler: RouteHandler) => {
      routes.set(`DELETE ${path}`, handler);
      return app;
    }),
  } as unknown as Express;

  registerMcpHttpRoutes(app);

  return {
    routes,
  };
}

function createMockResponse() {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  let resolver: ((value: { statusCode: number; body: unknown; headers: Record<string, string> }) => void) | undefined;

  const finished = new Promise<{ statusCode: number; body: unknown; headers: Record<string, string> }>((resolve) => {
    resolver = resolve;
  });

  const finish = () => {
    resolver?.({
      statusCode,
      body,
      headers: Object.fromEntries(headers),
    });
  };

  const res = {
    headersSent: false,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      res.headersSent = true;
      finish();
      return res;
    },
    sendStatus(code: number) {
      statusCode = code;
      res.headersSent = true;
      finish();
      return res;
    },
  };

  return { res: res as unknown as Response, finished };
}

async function dispatch(
  routes: Map<string, RouteHandler>,
  method: "GET" | "POST" | "DELETE",
  url: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  }
) {
  const handler = routes.get(`${method} ${url}`);
  if (!handler) {
    throw new Error(`Missing route ${method} ${url}`);
  }

  const headers = Object.fromEntries(
    Object.entries(options?.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  );

  const req = {
    method,
    url,
    body: options?.body,
    headers,
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;

  const { res, finished } = createMockResponse();
  handler(req, res);
  return await finished;
}

describe("registerMcpHttpRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.createdServers.length = 0;
    mockState.createdTransports.length = 0;
  });

  afterEach(async () => {
    await closeAllMcpHttpSessions();
  });

  it("registers POST, GET, and DELETE handlers on /mcp", () => {
    const { routes } = createCapturedApp();

    expect(routes.has("POST /mcp")).toBe(true);
    expect(routes.has("GET /mcp")).toBe(true);
    expect(routes.has("DELETE /mcp")).toBe(true);
  });

  it("creates a new transport and session on initialize", async () => {
    const { routes } = createCapturedApp();

    const response = await dispatch(routes, "POST", "/mcp", {
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["mcp-session-id"]).toBe("session-1");
    expect(mockState.createdServers).toHaveLength(1);
    expect(mockState.createdServers[0].connect).toHaveBeenCalledTimes(1);
  });

  it("reuses the existing session transport for subsequent requests", async () => {
    const { routes } = createCapturedApp();

    await dispatch(routes, "POST", "/mcp", {
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      },
    });

    const response = await dispatch(routes, "POST", "/mcp", {
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-session-id": "session-1",
        "mcp-protocol-version": "2025-03-26",
      },
      body: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      },
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as { result: { tools: Array<{ name: string }> } }).result.tools).toEqual([
      { name: "initiate_call" },
      { name: "join_meeting" },
    ]);
    expect(mockState.createdTransports).toHaveLength(1);
    expect(mockState.createdTransports[0].handledRequests).toHaveLength(2);
  });

  it("rejects non-initialize POST requests without a session id", async () => {
    const { routes } = createCapturedApp();

    const response = await dispatch(routes, "POST", "/mcp", {
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: {
        jsonrpc: "2.0",
        id: 9,
        method: "tools/list",
        params: {},
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        message: "Bad Request: No valid session ID provided",
      },
    });
  });

  it("closes the session when DELETE /mcp is received", async () => {
    const { routes } = createCapturedApp();

    await dispatch(routes, "POST", "/mcp", {
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      },
    });

    const response = await dispatch(routes, "DELETE", "/mcp", {
      headers: {
        "mcp-session-id": "session-1",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(mockState.createdServers[0].close).toHaveBeenCalledTimes(1);
  });
});

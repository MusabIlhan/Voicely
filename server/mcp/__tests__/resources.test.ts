import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "../resources.js";

// Mock the bridge module
vi.mock("../bridge.js", () => ({
  callBridgeAPI: vi.fn(),
}));

import { callBridgeAPI } from "../bridge.js";
const mockCallBridgeAPI = vi.mocked(callBridgeAPI);

// Capture resources registered by registerResources
type RegisteredEntry = {
  name: string;
  uri: string;
  metadata: { description?: string };
  callback: (...args: unknown[]) => Promise<unknown>;
};

function captureResources(): RegisteredEntry[] {
  const entries: RegisteredEntry[] = [];
  const server = {
    registerResource: vi.fn(
      (
        name: string,
        uri: string,
        metadata: { description?: string },
        cb: (...args: unknown[]) => Promise<unknown>
      ) => {
        entries.push({ name, uri, metadata, callback: cb });
      }
    ),
  } as unknown as McpServer;

  registerResources(server);
  return entries;
}

describe("registerResources", () => {
  let resources: RegisteredEntry[];

  beforeEach(() => {
    vi.clearAllMocks();
    resources = captureResources();
  });

  it("registers exactly 5 resources", () => {
    expect(resources).toHaveLength(5);
  });

  it("registers all expected resource URIs", () => {
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain("voisli://status");
    expect(uris).toContain("voisli://calls/active");
    expect(uris).toContain("voisli://calls/recent");
    expect(uris).toContain("voisli://meetings/active");
    expect(uris).toContain("voisli://meetings/recent");
  });

  it("every resource has a description", () => {
    for (const res of resources) {
      expect(res.metadata.description).toBeTruthy();
      expect(typeof res.metadata.description).toBe("string");
    }
  });
});

describe("voisli://status resource", () => {
  let resources: RegisteredEntry[];

  beforeEach(() => {
    vi.clearAllMocks();
    resources = captureResources();
  });

  it("calls GET /status on bridge server", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { uptime: 3600, activeCalls: 1, activeMeetings: 0 },
    });

    const resource = resources.find((r) => r.uri === "voisli://status")!;
    const result = (await resource.callback()) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };

    expect(mockCallBridgeAPI).toHaveBeenCalledWith("GET", "/status");
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe("voisli://status");
    expect(result.contents[0].mimeType).toBe("application/json");

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.uptime).toBe(3600);
    expect(parsed.activeCalls).toBe(1);
  });

  it("returns error data when bridge is unreachable", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: false,
      status: 0,
      data: { error: "Bridge server unreachable at http://localhost:8080: ECONNREFUSED" },
    });

    const resource = resources.find((r) => r.uri === "voisli://status")!;
    const result = (await resource.callback()) as {
      contents: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.error).toContain("unreachable");
  });
});

describe("voisli://calls/active resource", () => {
  let resources: RegisteredEntry[];

  beforeEach(() => {
    vi.clearAllMocks();
    resources = captureResources();
  });

  it("filters for in-progress and ringing calls", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        calls: [
          { sid: "CA1", status: "in-progress" },
          { sid: "CA2", status: "completed" },
          { sid: "CA3", status: "ringing" },
          { sid: "CA4", status: "failed" },
        ],
      },
    });

    const resource = resources.find((r) => r.uri === "voisli://calls/active")!;
    const result = (await resource.callback()) as {
      contents: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.calls).toHaveLength(2);
    expect(parsed.calls[0].sid).toBe("CA1");
    expect(parsed.calls[1].sid).toBe("CA3");
  });

  it("returns empty array when no calls exist", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {},
    });

    const resource = resources.find((r) => r.uri === "voisli://calls/active")!;
    const result = (await resource.callback()) as {
      contents: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.calls).toEqual([]);
  });
});

describe("voisli://calls/recent resource", () => {
  let resources: RegisteredEntry[];

  beforeEach(() => {
    vi.clearAllMocks();
    resources = captureResources();
  });

  it("returns last 10 calls", async () => {
    const calls = Array.from({ length: 15 }, (_, i) => ({
      sid: `CA${i}`,
      status: "completed",
    }));

    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { calls },
    });

    const resource = resources.find((r) => r.uri === "voisli://calls/recent")!;
    const result = (await resource.callback()) as {
      contents: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.calls).toHaveLength(10);
    expect(parsed.calls[0].sid).toBe("CA5");
    expect(parsed.calls[9].sid).toBe("CA14");
  });

  it("returns all calls when fewer than 10", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { calls: [{ sid: "CA1" }, { sid: "CA2" }] },
    });

    const resource = resources.find((r) => r.uri === "voisli://calls/recent")!;
    const result = (await resource.callback()) as {
      contents: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.calls).toHaveLength(2);
  });
});

describe("voisli://meetings/active resource", () => {
  let resources: RegisteredEntry[];

  beforeEach(() => {
    vi.clearAllMocks();
    resources = captureResources();
  });

  it("filters for listening and joining sessions", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        sessions: [
          { botId: "B1", status: "listening" },
          { botId: "B2", status: "ended" },
          { botId: "B3", status: "joining" },
        ],
      },
    });

    const resource = resources.find(
      (r) => r.uri === "voisli://meetings/active"
    )!;
    const result = (await resource.callback()) as {
      contents: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.meetings).toHaveLength(2);
    expect(parsed.meetings[0].botId).toBe("B1");
    expect(parsed.meetings[1].botId).toBe("B3");
  });

  it("returns empty array when no sessions exist", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: {},
    });

    const resource = resources.find(
      (r) => r.uri === "voisli://meetings/active"
    )!;
    const result = (await resource.callback()) as {
      contents: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.meetings).toEqual([]);
  });
});

describe("voisli://meetings/recent resource", () => {
  let resources: RegisteredEntry[];

  beforeEach(() => {
    vi.clearAllMocks();
    resources = captureResources();
  });

  it("returns last 10 meetings", async () => {
    const sessions = Array.from({ length: 12 }, (_, i) => ({
      botId: `B${i}`,
      status: "ended",
    }));

    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { sessions },
    });

    const resource = resources.find(
      (r) => r.uri === "voisli://meetings/recent"
    )!;
    const result = (await resource.callback()) as {
      contents: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.meetings).toHaveLength(10);
    expect(parsed.meetings[0].botId).toBe("B2");
    expect(parsed.meetings[9].botId).toBe("B11");
  });

  it("returns structured JSON with application/json mime type", async () => {
    mockCallBridgeAPI.mockResolvedValue({
      ok: true,
      status: 200,
      data: { sessions: [{ botId: "B1", status: "ended" }] },
    });

    const resource = resources.find(
      (r) => r.uri === "voisli://meetings/recent"
    )!;
    const result = (await resource.callback()) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };

    expect(result.contents[0].mimeType).toBe("application/json");
    expect(result.contents[0].uri).toBe("voisli://meetings/recent");
    // Verify it's valid JSON
    expect(() => JSON.parse(result.contents[0].text)).not.toThrow();
  });
});

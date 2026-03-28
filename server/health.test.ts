import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted — mocks must exist before vi.mock factories execute
// ---------------------------------------------------------------------------

const {
  mockIsConfigured,
  mockTwilioFetch,
  mockGeminiGet,
  mockCalendarList,
} = vi.hoisted(() => ({
  mockIsConfigured: vi.fn(),
  mockTwilioFetch: vi.fn(),
  mockGeminiGet: vi.fn(),
  mockCalendarList: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("./config", () => ({
  config: {
    twilio: {
      accountSid: "AC_test",
      authToken: "auth_test",
      phoneNumber: "+1234567890",
    },
    gemini: { apiKey: "test_key" },
    googleCalendar: {
      serviceAccountEmail: "test@test.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----",
      calendarId: "primary",
    },
    recall: {
      apiKey: "recall_test_key",
      apiBaseUrl: "https://us-west-2.recall.ai/api/v1",
    },
    server: {
      port: 8080,
      host: "localhost",
      publicUrl: "https://example.ngrok.io",
    },
  },
  isConfigured: mockIsConfigured,
}));

vi.mock("./callManager", () => ({
  callManager: {
    getCallCount: vi.fn(() => 0),
  },
}));

vi.mock("./meeting/meetingOrchestrator", () => ({
  meetingOrchestrator: {
    getAllSessions: vi.fn(() => []),
  },
}));

// Mock twilio
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    api: {
      accounts: vi.fn(() => ({
        fetch: mockTwilioFetch,
      })),
    },
  })),
}));

// Mock @google/genai
vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = { get: mockGeminiGet };
  },
}));

// Mock googleapis
vi.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: class MockAuth {},
    },
    calendar: vi.fn(() => ({
      calendarList: {
        list: mockCalendarList,
      },
    })),
  },
}));

// Mock global fetch for Recall.ai check
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { runHealthCheck } from "./health";
import type { HealthCheckResponse } from "./health";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runHealthCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfigured.mockReturnValue({
      twilio: true,
      gemini: true,
      googleCalendar: true,
      recall: true,
    });
    mockTwilioFetch.mockResolvedValue({ sid: "AC_test" });
    mockGeminiGet.mockResolvedValue({ name: "gemini-3.1-flash-lite-preview" });
    mockCalendarList.mockResolvedValue({ data: { items: [] } });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(""),
    });
  });

  it("returns healthy when all services are configured and reachable", async () => {
    const result = await runHealthCheck();

    expect(result.status).toBe("healthy");
    expect(result.services.twilio.status).toBe("healthy");
    expect(result.services.gemini.status).toBe("healthy");
    expect(result.services.googleCalendar.status).toBe("healthy");
    expect(result.services.recall.status).toBe("healthy");
    expect(result.timestamp).toBeTruthy();
    expect(typeof result.uptime).toBe("number");
    expect(typeof result.activeCalls).toBe("number");
    expect(typeof result.activeMeetings).toBe("number");
  });

  it("returns unconfigured for services without API keys", async () => {
    mockIsConfigured.mockReturnValue({
      twilio: false,
      gemini: true,
      googleCalendar: false,
      recall: false,
    });

    const result = await runHealthCheck();

    expect(result.services.twilio.status).toBe("unconfigured");
    expect(result.services.gemini.status).toBe("healthy");
    expect(result.services.googleCalendar.status).toBe("unconfigured");
    expect(result.services.recall.status).toBe("unconfigured");
    // Overall should be healthy (unconfigured is not a failure)
    expect(result.status).toBe("healthy");
  });

  it("reports latency for healthy services", async () => {
    const result = await runHealthCheck();

    expect(result.services.twilio.latencyMs).toBeDefined();
    expect(typeof result.services.twilio.latencyMs).toBe("number");
    expect(result.services.gemini.latencyMs).toBeDefined();
  });

  it("does not report latency for unconfigured services", async () => {
    mockIsConfigured.mockReturnValue({
      twilio: false,
      gemini: false,
      googleCalendar: false,
      recall: false,
    });

    const result = await runHealthCheck();

    expect(result.services.twilio.latencyMs).toBeUndefined();
    expect(result.services.gemini.latencyMs).toBeUndefined();
  });

  it("returns degraded when a non-core service is down", async () => {
    // Recall fails but Gemini is up
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const result = await runHealthCheck();

    expect(result.services.recall.status).toBe("down");
    expect(result.services.recall.error).toBeTruthy();
    expect(result.status).toBe("degraded");
  });

  it("returns down when Gemini (core) is unreachable", async () => {
    mockGeminiGet.mockRejectedValue(new Error("API key invalid"));

    const result = await runHealthCheck();

    expect(result.services.gemini.status).toBe("down");
    expect(result.services.gemini.error).toContain("API key invalid");
    expect(result.status).toBe("down");
  });

  it("includes error messages for failed services", async () => {
    mockFetch.mockRejectedValue(new Error("Network timeout"));

    const result = await runHealthCheck();

    expect(result.services.recall.status).toBe("down");
    expect(result.services.recall.error).toContain("Network timeout");
  });

  it("returns valid ISO timestamp", async () => {
    const result = await runHealthCheck();

    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it("all checks run concurrently (fast execution)", async () => {
    const start = Date.now();
    await runHealthCheck();
    const elapsed = Date.now() - start;

    // All checks run in parallel — should be fast (< 2s even with mock overhead)
    expect(elapsed).toBeLessThan(2000);
  });

  it("reports Twilio as down when API call fails", async () => {
    mockTwilioFetch.mockRejectedValue(new Error("Invalid credentials"));

    const result = await runHealthCheck();

    expect(result.services.twilio.status).toBe("down");
    expect(result.services.twilio.error).toContain("Invalid credentials");
    expect(result.services.twilio.latencyMs).toBeDefined();
  });

  it("reports Google Calendar as down when API call fails", async () => {
    mockCalendarList.mockRejectedValue(new Error("Auth failed"));

    const result = await runHealthCheck();

    expect(result.services.googleCalendar.status).toBe("down");
    expect(result.services.googleCalendar.error).toContain("Auth failed");
  });

  it("reports Recall as down on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    });

    const result = await runHealthCheck();

    expect(result.services.recall.status).toBe("down");
    expect(result.services.recall.error).toContain("HTTP 403");
  });
});

describe("HealthCheckResponse shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfigured.mockReturnValue({
      twilio: false,
      gemini: false,
      googleCalendar: false,
      recall: false,
    });
  });

  it("has the expected structure", async () => {
    const result: HealthCheckResponse = await runHealthCheck();

    // Top-level fields
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("uptime");
    expect(result).toHaveProperty("activeCalls");
    expect(result).toHaveProperty("activeMeetings");
    expect(result).toHaveProperty("services");
    expect(result).toHaveProperty("timestamp");

    // Services
    expect(result.services).toHaveProperty("twilio");
    expect(result.services).toHaveProperty("gemini");
    expect(result.services).toHaveProperty("googleCalendar");
    expect(result.services).toHaveProperty("recall");

    // Each service detail
    for (const service of Object.values(result.services)) {
      expect(service).toHaveProperty("status");
      expect(["healthy", "degraded", "down", "unconfigured"]).toContain(
        service.status
      );
    }
  });

  it("all unconfigured yields healthy overall", async () => {
    const result = await runHealthCheck();

    expect(result.status).toBe("healthy");
    expect(
      Object.values(result.services).every((s) => s.status === "unconfigured")
    ).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCallStatusHistory, initiateOutboundCall, recordCallStatus } from "./outbound";

vi.mock("../config", () => ({
  config: {
    twilio: {
      accountSid: "AC_test_sid",
      authToken: "test_auth_token",
      phoneNumber: "+15551234567",
    },
    server: {
      publicUrl: "https://example.ngrok.io",
      host: "localhost",
      port: 8080,
    },
  },
  isConfigured: vi.fn(),
}));

vi.mock("twilio", () => {
  const create = vi.fn();
  return {
    default: () => ({ calls: { create } }),
    __mockCreate: create,
  };
});

import { isConfigured } from "../config";

const mockIsConfigured = vi.mocked(isConfigured);

async function getMockCreate() {
  const mod = await vi.importMock<{ __mockCreate: ReturnType<typeof vi.fn> }>("twilio");
  return mod.__mockCreate;
}

describe("initiateOutboundCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error when Twilio is not configured", async () => {
    mockIsConfigured.mockReturnValue({
      twilio: false,
      gemini: true,
      googleCalendar: false,
      recall: false,
    });

    const result = await initiateOutboundCall("+15559998888", "session-1");
    expect(result.success).toBe(false);
    expect(result.sessionId).toBe("session-1");
  });

  it("uses the session-specific TwiML and status callback URLs", async () => {
    mockIsConfigured.mockReturnValue({
      twilio: true,
      gemini: true,
      googleCalendar: false,
      recall: false,
    });

    const create = await getMockCreate();
    create.mockResolvedValue({ sid: "CA123" });

    const result = await initiateOutboundCall("+15559998888", "session-1");
    expect(result.success).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.ngrok.io/twiml/session-1",
      statusCallback: "https://example.ngrok.io/call-status/session-1",
    }));
  });
});

describe("recordCallStatus", () => {
  it("stores status history per call sid", () => {
    recordCallStatus({
      callSid: "CA123",
      callStatus: "completed",
      direction: "outbound-api",
      to: "+15559998888",
      from: "+15551234567",
      timestamp: new Date().toISOString(),
    });

    expect(getCallStatusHistory("CA123")).toHaveLength(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  initiateOutboundCall,
  recordCallStatus,
  getCallStatusHistory,
  type CallStatusEvent,
} from "./outbound";

// Mock the config module
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

// Mock the twilio module
vi.mock("twilio", () => {
  const mockCreate = vi.fn();
  return {
    default: () => ({
      calls: { create: mockCreate },
    }),
    __mockCreate: mockCreate,
  };
});

import { isConfigured } from "../config";
import twilio from "twilio";

const mockIsConfigured = vi.mocked(isConfigured);

// Access the mock create function
async function getMockCreate() {
  const mod = await vi.importMock<{ __mockCreate: ReturnType<typeof vi.fn> }>("twilio");
  return mod.__mockCreate;
}

describe("initiateOutboundCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error when Twilio is not configured", async () => {
    mockIsConfigured.mockReturnValue({
      twilio: false,
      gemini: true,
      googleCalendar: false,
      recall: false,
    });

    const result = await initiateOutboundCall("+15559998888", "Test call");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Twilio is not configured");
    expect(result.toNumber).toBe("+15559998888");
    expect(result.purpose).toBe("Test call");
  });

  it("should return error when PUBLIC_SERVER_URL is not configured", async () => {
    mockIsConfigured.mockReturnValue({
      twilio: true,
      gemini: true,
      googleCalendar: false,
      recall: false,
    });

    // Override publicUrl to be a placeholder
    const { config } = await import("../config");
    const originalUrl = config.server.publicUrl;
    config.server.publicUrl = "https://your-ngrok-url.ngrok.io";

    const result = await initiateOutboundCall("+15559998888", "Test call");

    expect(result.success).toBe(false);
    expect(result.error).toContain("PUBLIC_SERVER_URL is not configured");

    config.server.publicUrl = originalUrl;
  });

  it("should call Twilio API and return success on valid config", async () => {
    mockIsConfigured.mockReturnValue({
      twilio: true,
      gemini: true,
      googleCalendar: false,
      recall: false,
    });

    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({ sid: "CA_test_call_sid_123" });

    const result = await initiateOutboundCall("+15559998888", "Make a reservation");

    expect(result.success).toBe(true);
    expect(result.callSid).toBe("CA_test_call_sid_123");
    expect(result.toNumber).toBe("+15559998888");
    expect(result.purpose).toBe("Make a reservation");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+15559998888",
        from: "+15551234567",
      })
    );
  });

  it("should handle Twilio API errors gracefully", async () => {
    mockIsConfigured.mockReturnValue({
      twilio: true,
      gemini: true,
      googleCalendar: false,
      recall: false,
    });

    const mockCreate = await getMockCreate();
    mockCreate.mockRejectedValue(new Error("Invalid phone number"));

    const result = await initiateOutboundCall("+15559998888", "Test call");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid phone number");
  });
});

describe("call status tracking", () => {
  it("should record and retrieve status events", () => {
    const event: CallStatusEvent = {
      callSid: "CA_status_test",
      callStatus: "ringing",
      direction: "outbound-api",
      to: "+15559998888",
      from: "+15551234567",
      timestamp: new Date().toISOString(),
    };

    recordCallStatus(event);

    const history = getCallStatusHistory("CA_status_test");
    expect(history).toHaveLength(1);
    expect(history[0].callStatus).toBe("ringing");
  });

  it("should accumulate multiple status events for the same call", () => {
    const sid = "CA_multi_status";

    recordCallStatus({
      callSid: sid,
      callStatus: "initiated",
      direction: "outbound-api",
      to: "+15559998888",
      from: "+15551234567",
      timestamp: new Date().toISOString(),
    });

    recordCallStatus({
      callSid: sid,
      callStatus: "ringing",
      direction: "outbound-api",
      to: "+15559998888",
      from: "+15551234567",
      timestamp: new Date().toISOString(),
    });

    recordCallStatus({
      callSid: sid,
      callStatus: "completed",
      direction: "outbound-api",
      to: "+15559998888",
      from: "+15551234567",
      timestamp: new Date().toISOString(),
    });

    const history = getCallStatusHistory(sid);
    expect(history).toHaveLength(3);
    expect(history.map((e) => e.callStatus)).toEqual([
      "initiated",
      "ringing",
      "completed",
    ]);
  });

  it("should return empty array for unknown call SID", () => {
    const history = getCallStatusHistory("CA_nonexistent");
    expect(history).toEqual([]);
  });
});

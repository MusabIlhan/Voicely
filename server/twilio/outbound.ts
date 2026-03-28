import twilio from "twilio";
import { config, isConfigured } from "../config";

export interface OutboundCallResult {
  success: boolean;
  callSid?: string;
  toNumber: string;
  fromNumber: string;
  purpose: string;
  error?: string;
}

export interface CallStatusEvent {
  callSid: string;
  callStatus: string;
  direction: string;
  to: string;
  from: string;
  timestamp: string;
}

/** In-memory store for outbound call status updates. */
const callStatuses = new Map<string, CallStatusEvent[]>();

/**
 * Initiate an outbound phone call via the Twilio REST API.
 *
 * When the callee picks up, Twilio fetches TwiML from /twiml/outbound which
 * opens a bidirectional media stream — the same bridge that handles inbound
 * calls. The `purpose` is passed as a custom parameter so the orchestrator
 * knows which system prompt to use.
 */
export async function initiateOutboundCall(
  toNumber: string,
  purpose: string
): Promise<OutboundCallResult> {
  if (!isConfigured().twilio) {
    return {
      success: false,
      toNumber,
      fromNumber: config.twilio.phoneNumber || "not_configured",
      purpose,
      error:
        "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file.",
    };
  }

  if (!config.server.publicUrl || config.server.publicUrl.startsWith("https://your-")) {
    return {
      success: false,
      toNumber,
      fromNumber: config.twilio.phoneNumber,
      purpose,
      error:
        "PUBLIC_SERVER_URL is not configured. Twilio needs a public URL for TwiML and status callbacks.",
    };
  }

  const client = twilio(config.twilio.accountSid, config.twilio.authToken);

  const twimlUrl = `${config.server.publicUrl}/twiml/outbound?purpose=${encodeURIComponent(purpose)}`;
  const statusCallbackUrl = `${config.server.publicUrl}/call-status`;

  try {
    const call = await client.calls.create({
      to: toNumber,
      from: config.twilio.phoneNumber,
      url: twimlUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });

    console.log(
      `[Outbound] Call initiated — SID: ${call.sid}, to: ${toNumber}, purpose: ${purpose}`
    );

    return {
      success: true,
      callSid: call.sid,
      toNumber,
      fromNumber: config.twilio.phoneNumber,
      purpose,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Outbound] Failed to initiate call: ${message}`);
    return {
      success: false,
      toNumber,
      fromNumber: config.twilio.phoneNumber,
      purpose,
      error: message,
    };
  }
}

/**
 * Record a call status callback event.
 */
export function recordCallStatus(event: CallStatusEvent): void {
  const existing = callStatuses.get(event.callSid) ?? [];
  existing.push(event);
  callStatuses.set(event.callSid, existing);
  console.log(
    `[Outbound] Status update — SID: ${event.callSid}, status: ${event.callStatus}`
  );
}

/**
 * Get all recorded status events for a call.
 */
export function getCallStatusHistory(callSid: string): CallStatusEvent[] {
  return callStatuses.get(callSid) ?? [];
}

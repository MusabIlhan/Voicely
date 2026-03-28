import twilio from "twilio";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import { config, isConfigured } from "./config";
import { voiceCoordinator } from "./voice/voiceCoordinator";

// ---------------------------------------------------------------------------
// Health check module — tests connectivity to external services and reports
// their status. Used by the GET /health endpoint.
// ---------------------------------------------------------------------------

export type ServiceHealth = "healthy" | "degraded" | "down" | "unconfigured";

export interface ServiceHealthDetail {
  status: ServiceHealth;
  latencyMs?: number;
  error?: string;
}

export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "down";
  uptime: number;
  activeCalls: number;
  activeMeetings: number;
  services: {
    twilio: ServiceHealthDetail;
    gemini: ServiceHealthDetail;
    googleCalendar: ServiceHealthDetail;
    recall: ServiceHealthDetail;
  };
  timestamp: string;
}

const startTime = Date.now();

/**
 * Test Twilio API connectivity by fetching account info.
 */
async function checkTwilio(): Promise<ServiceHealthDetail> {
  if (!isConfigured().twilio) {
    return { status: "unconfigured" };
  }

  const start = Date.now();
  try {
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    await client.api.accounts(config.twilio.accountSid).fetch();
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "down", latencyMs: Date.now() - start, error: message };
  }
}

/**
 * Test Gemini API connectivity by getting model info.
 */
async function checkGemini(): Promise<ServiceHealthDetail> {
  if (!isConfigured().gemini) {
    return { status: "unconfigured" };
  }

  const start = Date.now();
  try {
    const genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });
    await genAI.models.get({ model: "gemini-3.1-flash-lite-preview" });
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "down", latencyMs: Date.now() - start, error: message };
  }
}

/**
 * Test Google Calendar API connectivity by listing calendars.
 */
async function checkGoogleCalendar(): Promise<ServiceHealthDetail> {
  if (!isConfigured().googleCalendar) {
    return { status: "unconfigured" };
  }

  const start = Date.now();
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.googleCalendar.serviceAccountEmail,
        private_key: config.googleCalendar.privateKey.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.calendarList.list({ maxResults: 1 });
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "down", latencyMs: Date.now() - start, error: message };
  }
}

/**
 * Test Recall.ai API connectivity by listing bots.
 */
async function checkRecall(): Promise<ServiceHealthDetail> {
  if (!isConfigured().recall) {
    return { status: "unconfigured" };
  }

  const start = Date.now();
  try {
    const baseUrl = config.recall.apiBaseUrl.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/bot/?limit=1`, {
      headers: {
        Authorization: `Token ${config.recall.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "down",
        latencyMs: Date.now() - start,
        error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "down", latencyMs: Date.now() - start, error: message };
  }
}

/**
 * Run all health checks concurrently and return a consolidated report.
 */
export async function runHealthCheck(): Promise<HealthCheckResponse> {
  const [twilioResult, geminiResult, googleCalendarResult, recallResult] =
    await Promise.all([
      checkTwilio(),
      checkGemini(),
      checkGoogleCalendar(),
      checkRecall(),
    ]);

  const services = {
    twilio: twilioResult,
    gemini: geminiResult,
    googleCalendar: googleCalendarResult,
    recall: recallResult,
  };

  // Determine overall status
  const statuses = Object.values(services).map((s) => s.status);
  const hasDown = statuses.some((s) => s === "down");
  const allHealthyOrUnconfigured = statuses.every(
    (s) => s === "healthy" || s === "unconfigured"
  );

  let overallStatus: "healthy" | "degraded" | "down";
  if (allHealthyOrUnconfigured) {
    overallStatus = "healthy";
  } else if (hasDown) {
    // If core services (Gemini) are down, system is down; otherwise degraded
    overallStatus = geminiResult.status === "down" ? "down" : "degraded";
  } else {
    overallStatus = "degraded";
  }

  const activeSessions = voiceCoordinator.getAllSessions();
  const activeMeetings = activeSessions.filter(
    (session) => session.channel === "meeting" && session.status === "active"
  ).length;
  const activeCalls = activeSessions.filter(
    (session) => session.channel === "phone" && session.status === "active"
  ).length;

  return {
    status: overallStatus,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    activeCalls,
    activeMeetings,
    services,
    timestamp: new Date().toISOString(),
  };
}

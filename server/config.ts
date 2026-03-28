import dotenv from "dotenv";

dotenv.config();

export interface ServerConfig {
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  gemini: {
    apiKey: string;
  };
  googleCalendar: {
    serviceAccountEmail: string;
    privateKey: string;
    calendarId: string;
  };
  recall: {
    apiKey: string;
    apiBaseUrl: string;
  };
  server: {
    port: number;
    host: string;
    publicUrl: string;
  };
  nextPublicBridgeServerUrl: string;
  bridgeServerUrl: string;
}

export interface ServiceStatus {
  twilio: boolean;
  gemini: boolean;
  googleCalendar: boolean;
  recall: boolean;
}

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  return value ?? "";
}

function isPlaceholder(value: string): boolean {
  return (
    !value ||
    value.startsWith("your_") ||
    value === "+1234567890" ||
    value.startsWith("https://your-")
  );
}

export const config: ServerConfig = {
  twilio: {
    accountSid: getEnv("TWILIO_ACCOUNT_SID"),
    authToken: getEnv("TWILIO_AUTH_TOKEN"),
    phoneNumber: getEnv("TWILIO_PHONE_NUMBER"),
  },
  gemini: {
    apiKey: getEnv("GEMINI_API_KEY"),
  },
  googleCalendar: {
    serviceAccountEmail: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: getEnv("GOOGLE_PRIVATE_KEY"),
    calendarId: getEnv("GOOGLE_CALENDAR_ID", "primary"),
  },
  recall: {
    apiKey: getEnv("RECALL_API_KEY"),
    apiBaseUrl: getEnv(
      "RECALL_API_BASE_URL",
      "https://us-west-2.recall.ai/api/v1"
    ),
  },
  server: {
    port: parseInt(getEnv("BRIDGE_SERVER_PORT", "8080"), 10),
    host: getEnv("BRIDGE_SERVER_HOST", "localhost"),
    publicUrl: getEnv("PUBLIC_SERVER_URL"),
  },
  nextPublicBridgeServerUrl: getEnv(
    "NEXT_PUBLIC_BRIDGE_SERVER_URL",
    "http://localhost:8080"
  ),
  bridgeServerUrl: getEnv("BRIDGE_SERVER_URL", "http://localhost:8080"),
};

export function isConfigured(): ServiceStatus {
  return {
    twilio:
      !isPlaceholder(config.twilio.accountSid) &&
      !isPlaceholder(config.twilio.authToken) &&
      !isPlaceholder(config.twilio.phoneNumber),
    gemini: !isPlaceholder(config.gemini.apiKey),
    googleCalendar:
      !isPlaceholder(config.googleCalendar.serviceAccountEmail) &&
      !isPlaceholder(config.googleCalendar.privateKey),
    recall: !isPlaceholder(config.recall.apiKey),
  };
}

export function validateConfig(): void {
  const status = isConfigured();
  const missing: string[] = [];

  if (!status.twilio) {
    missing.push(
      "Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)"
    );
  }
  if (!status.gemini) {
    missing.push("Gemini (GEMINI_API_KEY)");
  }
  if (!status.googleCalendar) {
    missing.push(
      "Google Calendar (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY)"
    );
  }
  if (!status.recall) {
    missing.push("Recall.ai (RECALL_API_KEY)");
  }

  if (missing.length > 0) {
    console.warn(
      `⚠ Missing or placeholder configuration for: ${missing.join(", ")}`
    );
    console.warn("  The bridge server will start, but calls will not work.");
    console.warn("  Copy .env.example to .env and fill in your API keys.");
  }

  if (isPlaceholder(config.server.publicUrl)) {
    console.warn(
      "⚠ PUBLIC_SERVER_URL is not set. Twilio webhooks will not work until this is configured (e.g., via ngrok)."
    );
  }
}

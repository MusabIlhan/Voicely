import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import { config, isConfigured } from "../config.js";
import type {
  GoogleWorkspaceAccount,
  GoogleWorkspaceResolution,
  GoogleWorkspaceStoreData,
} from "./types.js";

const DEFAULT_RETURN_TO = "http://localhost:3000/integrations";

export const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/presentations.readonly",
] as const;

interface OAuthState {
  returnTo?: string;
}

function tokenStorePath(): string {
  const configured = config.googleWorkspace.tokenStorePath.trim();
  if (path.isAbsolute(configured)) {
    return configured;
  }
  return path.resolve(process.cwd(), configured);
}

async function ensureTokenStoreDir(): Promise<void> {
  await mkdir(path.dirname(tokenStorePath()), { recursive: true });
}

async function readStore(): Promise<GoogleWorkspaceStoreData> {
  try {
    const raw = await readFile(tokenStorePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<GoogleWorkspaceStoreData>;
    return {
      accounts: parsed.accounts ?? {},
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return { accounts: {} };
    }
    throw error;
  }
}

async function writeStore(store: GoogleWorkspaceStoreData): Promise<void> {
  await ensureTokenStoreDir();
  await writeFile(tokenStorePath(), JSON.stringify(store, null, 2), "utf8");
}

function workspaceAuthConfigured(): boolean {
  return Boolean(isConfigured().googleWorkspaceOAuth);
}

function createOAuth2Client(tokens?: Credentials) {
  const client = new google.auth.OAuth2(
    config.googleWorkspace.clientId,
    config.googleWorkspace.clientSecret,
    config.googleWorkspace.redirectUri,
  );

  if (tokens) {
    client.setCredentials(tokens);
  }

  return client;
}

function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodeState(raw?: string): OAuthState {
  if (!raw) {
    return {};
  }

  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return JSON.parse(json) as OAuthState;
  } catch {
    return {};
  }
}

function accountSummary(account: GoogleWorkspaceAccount) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    picture: account.picture,
    updatedAt: account.updatedAt,
  };
}

async function persistAccountTokens(
  accountId: string,
  tokens: Credentials,
): Promise<GoogleWorkspaceAccount | null> {
  const store = await readStore();
  const existing = store.accounts[accountId];
  if (!existing) {
    return null;
  }

  const mergedTokens: Credentials = {
    ...existing.tokens,
    ...tokens,
    refresh_token: tokens.refresh_token ?? existing.tokens.refresh_token,
  };

  const updated: GoogleWorkspaceAccount = {
    ...existing,
    tokens: mergedTokens,
    updatedAt: new Date().toISOString(),
  };

  store.accounts[accountId] = updated;
  await writeStore(store);
  return updated;
}

export function getGoogleAuthUrl(returnTo?: string): string {
  if (!workspaceAuthConfigured()) {
    throw new Error(
      "Google Workspace OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.",
    );
  }

  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_WORKSPACE_SCOPES],
    state: encodeState({
      returnTo: returnTo?.trim() || DEFAULT_RETURN_TO,
    }),
  });
}

export async function exchangeCodeForWorkspaceAccount(params: {
  code: string;
  state?: string;
}): Promise<{ account: ReturnType<typeof accountSummary>; returnTo: string }> {
  if (!workspaceAuthConfigured()) {
    throw new Error(
      "Google Workspace OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.",
    );
  }

  const client = createOAuth2Client();
  const tokenResponse = await client.getToken(params.code);
  client.setCredentials(tokenResponse.tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = (await oauth2.userinfo.get()).data;
  const email = profile.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("Google OAuth did not return an email address.");
  }

  const store = await readStore();
  const now = new Date().toISOString();
  const existing = store.accounts[email];

  const account: GoogleWorkspaceAccount = {
    id: email,
    email,
    name: profile.name?.trim() || email,
    picture: profile.picture ?? undefined,
    tokens: {
      ...existing?.tokens,
      ...tokenResponse.tokens,
      refresh_token:
        tokenResponse.tokens.refresh_token ?? existing?.tokens.refresh_token,
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  store.accounts[email] = account;
  await writeStore(store);

  const state = decodeState(params.state);
  return {
    account: accountSummary(account),
    returnTo: state.returnTo?.trim() || DEFAULT_RETURN_TO,
  };
}

export async function listWorkspaceAccounts(): Promise<
  Array<ReturnType<typeof accountSummary>>
> {
  const store = await readStore();
  return Object.values(store.accounts)
    .sort((a, b) => a.email.localeCompare(b.email))
    .map(accountSummary);
}

export async function getWorkspaceStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  accounts: Array<ReturnType<typeof accountSummary>>;
}> {
  const accounts = await listWorkspaceAccounts();
  return {
    configured: workspaceAuthConfigured(),
    connected: accounts.length > 0,
    accounts,
  };
}

export async function resolveWorkspaceAccount(
  preferredAccountId?: string,
): Promise<GoogleWorkspaceResolution> {
  if (!workspaceAuthConfigured()) {
    return {
      ok: false,
      code: "oauth_not_configured",
      error:
        "Google Workspace OAuth is not configured. Set the Google OAuth environment variables and reconnect.",
    };
  }

  const store = await readStore();
  const accounts = Object.values(store.accounts).sort((a, b) =>
    a.email.localeCompare(b.email),
  );

  if (preferredAccountId) {
    const selected = store.accounts[preferredAccountId];
    if (!selected) {
      return {
        ok: false,
        code: "account_not_found",
        error: `Google Workspace account "${preferredAccountId}" was not found. Reconnect the account or choose another one.`,
        accounts: accounts.map(accountSummary),
      };
    }

    return { ok: true, account: selected };
  }

  if (accounts.length === 0) {
    return {
      ok: false,
      code: "no_accounts",
      error:
        "No Google Workspace account is connected. Open Integrations and connect Google Workspace first.",
    };
  }

  if (accounts.length > 1) {
    return {
      ok: false,
      code: "multiple_accounts",
      error:
        "Multiple Google Workspace accounts are connected. Choose the account when joining the meeting.",
      accounts: accounts.map(accountSummary),
    };
  }

  return {
    ok: true,
    account: accounts[0],
  };
}

export async function getAuthorizedWorkspaceClient(
  preferredAccountId?: string,
): Promise<GoogleWorkspaceResolution & { client?: InstanceType<typeof google.auth.OAuth2> }> {
  const resolution = await resolveWorkspaceAccount(preferredAccountId);
  if (!resolution.ok || !resolution.account) {
    return resolution;
  }

  const client = createOAuth2Client(resolution.account.tokens);
  await client.getAccessToken();

  if (
    JSON.stringify(client.credentials) !== JSON.stringify(resolution.account.tokens)
  ) {
    const updatedAccount = await persistAccountTokens(
      resolution.account.id,
      client.credentials,
    );
    if (updatedAccount) {
      resolution.account = updatedAccount;
    }
  }

  return {
    ...resolution,
    client,
  };
}

import { google } from "googleapis";
import type { ToolExecutionContext } from "../tools/types.js";
import { getAuthorizedWorkspaceClient } from "./auth.js";
import type { TranscriptEntry } from "../meeting/types.js";

function ensureMeetingWorkspaceContext(context?: ToolExecutionContext) {
  if (!context || context.agent !== "meeting") {
    throw new Error("Google Workspace tools are only available to the meeting agent.");
  }
}

async function getWorkspaceAuth(context?: ToolExecutionContext) {
  ensureMeetingWorkspaceContext(context);
  const resolution = await getAuthorizedWorkspaceClient(context?.workspaceAccountId);
  if (!resolution.ok || !resolution.client || !resolution.account) {
    throw new Error(resolution.error ?? "No Google Workspace account is available.");
  }

  return {
    client: resolution.client,
    account: resolution.account,
  };
}

function escapeDriveQuery(value: string): string {
  return value.replace(/'/g, "\\'");
}

function collectDocText(content: Array<Record<string, unknown>> | undefined): string {
  if (!content) {
    return "";
  }

  const parts: string[] = [];
  for (const block of content) {
    const paragraph = block.paragraph as
      | { elements?: Array<{ textRun?: { content?: string } }> }
      | undefined;

    if (paragraph?.elements) {
      const text = paragraph.elements
        .map((element) => element.textRun?.content ?? "")
        .join("")
        .trimEnd();
      if (text.trim()) {
        parts.push(text.trim());
      }
    }

    const table = block.table as
      | {
          tableRows?: Array<{
            tableCells?: Array<{
              content?: Array<Record<string, unknown>>;
            }>;
          }>;
        }
      | undefined;

    if (table?.tableRows) {
      for (const row of table.tableRows) {
        const rowText = (row.tableCells ?? [])
          .map((cell) => collectDocText(cell.content))
          .filter(Boolean)
          .join(" | ");
        if (rowText) {
          parts.push(rowText);
        }
      }
    }
  }

  return parts.join("\n");
}

function collectSlideText(pageElements?: Array<Record<string, unknown>>): string[] {
  if (!pageElements) {
    return [];
  }

  const lines: string[] = [];
  for (const element of pageElements) {
    const shape = element.shape as
      | {
          text?: {
            textElements?: Array<{
              textRun?: { content?: string };
            }>;
          };
        }
      | undefined;

    const text = shape?.text?.textElements
      ?.map((item) => item.textRun?.content ?? "")
      .join("")
      .trim();

    if (text) {
      lines.push(text);
    }
  }

  return lines;
}

function formatTranscript(transcript?: TranscriptEntry[]): string {
  if (!transcript || transcript.length === 0) {
    return "No transcript captured yet.";
  }

  return transcript
    .slice(-30)
    .map((entry) => {
      const time = new Date(entry.timestamp).toISOString();
      return `[${time}] ${entry.speaker}: ${entry.text}`;
    })
    .join("\n");
}

export async function searchCalendarEvents(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const { client, account } = await getWorkspaceAuth(context);
  const calendar = google.calendar({ version: "v3", auth: client });

  const maxResults = Math.min(Number(args.max_results ?? 10), 25);
  const response = await calendar.events.list({
    calendarId: (args.calendar_id as string | undefined) || "primary",
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
    q: (args.query as string | undefined) || undefined,
    timeMin:
      (args.time_min as string | undefined) ||
      new Date().toISOString(),
    timeMax: args.time_max as string | undefined,
  });

  const events = (response.data.items ?? []).map((event) => ({
    id: event.id,
    title: event.summary ?? "Untitled event",
    description: event.description ?? "",
    location: event.location ?? "",
    status: event.status ?? "",
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    link: event.htmlLink ?? "",
  }));

  return {
    success: true,
    accountEmail: account.email,
    events,
    count: events.length,
    message:
      events.length > 0
        ? `Found ${events.length} calendar event(s).`
        : "No matching calendar events were found.",
  };
}

export async function createCalendarEventFromWorkspace(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const { client, account } = await getWorkspaceAuth(context);
  const calendar = google.calendar({ version: "v3", auth: client });

  const date = String(args.date ?? "");
  const timeStart = String(args.time_start ?? "");
  const timeEnd = String(args.time_end ?? "");
  const timeZone = String(args.time_zone ?? "UTC");

  const response = await calendar.events.insert({
    calendarId: (args.calendar_id as string | undefined) || "primary",
    requestBody: {
      summary: String(args.title ?? "Untitled event"),
      description: (args.description as string | undefined) || undefined,
      location: (args.location as string | undefined) || undefined,
      start: {
        dateTime: new Date(`${date}T${timeStart}:00`).toISOString(),
        timeZone,
      },
      end: {
        dateTime: new Date(`${date}T${timeEnd}:00`).toISOString(),
        timeZone,
      },
    },
  });

  return {
    success: true,
    accountEmail: account.email,
    event_id: response.data.id ?? "",
    link: response.data.htmlLink ?? "",
    title: response.data.summary ?? String(args.title ?? "Untitled event"),
    message: `Created calendar event "${response.data.summary ?? args.title ?? "Untitled event"}".`,
  };
}

export async function searchDriveFiles(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const { client, account } = await getWorkspaceAuth(context);
  const drive = google.drive({ version: "v3", auth: client });
  const query = String(args.query ?? "").trim();
  const mimeType = String(args.mime_type ?? "").trim();
  const maxResults = Math.min(Number(args.max_results ?? 10), 25);

  const queryParts = ["trashed = false"];
  if (query) {
    const escaped = escapeDriveQuery(query);
    queryParts.push(`(name contains '${escaped}' or fullText contains '${escaped}')`);
  }
  if (mimeType) {
    queryParts.push(`mimeType = '${escapeDriveQuery(mimeType)}'`);
  }

  const response = await drive.files.list({
    q: queryParts.join(" and "),
    pageSize: maxResults,
    fields:
      "files(id,name,mimeType,webViewLink,modifiedTime,owners(displayName,emailAddress))",
    orderBy: "modifiedTime desc",
  });

  const files = (response.data.files ?? []).map((file) => ({
    id: file.id ?? "",
    name: file.name ?? "Untitled file",
    mimeType: file.mimeType ?? "",
    link: file.webViewLink ?? "",
    modifiedTime: file.modifiedTime ?? "",
    owners: (file.owners ?? []).map((owner) => ({
      name: owner.displayName ?? "",
      email: owner.emailAddress ?? "",
    })),
  }));

  return {
    success: true,
    accountEmail: account.email,
    files,
    count: files.length,
    message:
      files.length > 0
        ? `Found ${files.length} Drive file(s).`
        : "No matching Drive files were found.",
  };
}

export async function readGoogleDoc(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const { client, account } = await getWorkspaceAuth(context);
  const docs = google.docs({ version: "v1", auth: client });
  const documentId = String(args.document_id ?? "");
  const response = await docs.documents.get({ documentId });
  const content = collectDocText(
    response.data.body?.content as Array<Record<string, unknown>> | undefined,
  );

  return {
    success: true,
    accountEmail: account.email,
    documentId,
    title: response.data.title ?? "Untitled document",
    content,
    message: `Loaded Google Doc "${response.data.title ?? "Untitled document"}".`,
  };
}

export async function readGoogleSheet(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const { client, account } = await getWorkspaceAuth(context);
  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = String(args.spreadsheet_id ?? "");

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties.title",
  });

  const firstSheetTitle =
    meta.data.sheets?.[0]?.properties?.title ?? "Sheet1";
  const requestedRange =
    (args.range as string | undefined)?.trim() || `${firstSheetTitle}!A1:Z20`;

  const values = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: requestedRange,
  });

  return {
    success: true,
    accountEmail: account.email,
    spreadsheetId,
    title: meta.data.properties?.title ?? "Untitled spreadsheet",
    range: requestedRange,
    values: values.data.values ?? [],
    message: `Loaded sheet range ${requestedRange}.`,
  };
}

export async function readGoogleSlideDeck(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const { client, account } = await getWorkspaceAuth(context);
  const slides = google.slides({ version: "v1", auth: client });
  const presentationId = String(args.presentation_id ?? "");
  const response = await slides.presentations.get({ presentationId });

  const slideSummaries = (response.data.slides ?? []).map((slide, index) => ({
    objectId: slide.objectId ?? "",
    index: index + 1,
    text: collectSlideText(slide.pageElements as Array<Record<string, unknown>>)
      .join(" ")
      .trim(),
  }));

  return {
    success: true,
    accountEmail: account.email,
    presentationId,
    title: response.data.title ?? "Untitled presentation",
    slides: slideSummaries,
    message: `Loaded slide deck "${response.data.title ?? "Untitled presentation"}".`,
  };
}

export async function createMeetingNotesDoc(
  _args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const { client, account } = await getWorkspaceAuth(context);
  const docs = google.docs({ version: "v1", auth: client });
  const meetingUrl = context?.meetingContext?.meetingUrl ?? "Meeting";
  const startedAt = new Date().toISOString();
  const title = `Meeting Notes - ${new Date().toLocaleDateString()} - ${meetingUrl}`;

  const created = await docs.documents.create({
    requestBody: { title },
  });

  const documentId = created.data.documentId;
  if (!documentId) {
    throw new Error("Google Docs did not return a document id.");
  }

  const body = [
    `Meeting Notes`,
    ``,
    `Meeting URL: ${meetingUrl}`,
    `Generated At: ${startedAt}`,
    ``,
    `Summary`,
    context?.meetingContext?.summary ?? "No summary available yet.",
    ``,
    `Recent Transcript`,
    formatTranscript(context?.meetingContext?.transcript),
    ``,
  ].join("\n");

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: body,
          },
        },
      ],
    },
  });

  return {
    success: true,
    accountEmail: account.email,
    documentId,
    title,
    link: `https://docs.google.com/document/d/${documentId}/edit`,
    message: `Created meeting notes doc "${title}".`,
  };
}

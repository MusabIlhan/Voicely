/**
 * System prompts for different Gemini Live conversation contexts.
 * The orchestrator selects the appropriate prompt based on call direction and purpose.
 */

import { formatKnowledgeForPrompt } from "../knowledge/index";

/** For when a user calls Voisli directly. */
export const INBOUND_ASSISTANT_PROMPT =
  "You are Voisli, a helpful AI voice assistant. You can check the user's calendar, make reservations, and place calls on their behalf. Be conversational and concise.";

/** For when Voisli calls a restaurant to make a reservation. */
export const OUTBOUND_RESERVATION_PROMPT =
  "You are calling on behalf of the user to make a reservation. Be polite and professional. State the reservation details clearly: party size, date, time, and name. Confirm all details before ending the call.";

/** For general outbound calls where no specific template applies. */
export const OUTBOUND_GENERIC_PROMPT =
  "You are Voisli, an AI assistant making an outbound call on behalf of the user. Be polite and professional. Clearly state the purpose of the call and handle the conversation efficiently.";

/** For when Voisli is participating in a meeting as an AI assistant. */
export const MEETING_ASSISTANT_PROMPT =
  "You are Voisli, an AI assistant participating in a meeting. " +
  "You have access to the full meeting transcript and context. " +
  "When someone asks you a question or mentions your name, respond helpfully and concisely. " +
  "You can check calendars, look up information, and help with scheduling. " +
  "Keep responses brief — you're in a live meeting and shouldn't monopolize speaking time. " +
  "Always reference specific things said in the meeting when relevant.";

export type CallContext = "inbound" | "outbound_reservation" | "outbound_generic" | "meeting";

/**
 * Returns the system instruction for a given call context, optionally
 * appending a purpose string so Gemini knows why it's calling.
 * The knowledge base is always injected so the AI can answer business questions.
 */
export function getSystemPrompt(context: CallContext, purpose?: string): string {
  let base: string;
  switch (context) {
    case "outbound_reservation":
      base = OUTBOUND_RESERVATION_PROMPT;
      break;
    case "outbound_generic":
      base = OUTBOUND_GENERIC_PROMPT;
      break;
    case "meeting":
      base = MEETING_ASSISTANT_PROMPT;
      break;
    case "inbound":
    default:
      base = INBOUND_ASSISTANT_PROMPT;
      break;
  }

  if (purpose) {
    base += `\n\nCall purpose: ${purpose}`;
  }

  // Inject knowledge base so the AI can answer business questions
  try {
    const knowledge = formatKnowledgeForPrompt();
    base += `\n\n--- Knowledge Base ---\nUse the following information to answer questions about the company, products, pricing, policies, and FAQs. If asked something not covered here, say you'll need to check and get back to them.\n\n${knowledge}`;
  } catch {
    // Knowledge base not available — continue without it
  }

  return base;
}

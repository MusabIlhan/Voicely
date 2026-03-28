/**
 * System prompts for different Gemini Live conversation contexts.
 * The orchestrator selects the appropriate prompt based on call direction and purpose.
 */

/** For when a user calls Voisli directly. */
export const INBOUND_ASSISTANT_PROMPT =
  "You are Voisli, a helpful AI voice assistant. You can check the user's calendar, make reservations, and place calls on their behalf. Be conversational and concise.";

/** For when Voisli calls a restaurant to make a reservation. */
export const OUTBOUND_RESERVATION_PROMPT =
  "You are calling on behalf of the user to make a reservation. Be polite and professional. State the reservation details clearly: party size, date, time, and name. Confirm all details before ending the call.";

/** For general outbound calls where no specific template applies. */
export const OUTBOUND_GENERIC_PROMPT =
  "You are Voisli, an AI assistant making an outbound call on behalf of the user. Be polite and professional. Clearly state the purpose of the call and handle the conversation efficiently.";

export type CallContext = "inbound" | "outbound_reservation" | "outbound_generic";

/**
 * Returns the system instruction for a given call context, optionally
 * appending a purpose string so Gemini knows why it's calling.
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
    case "inbound":
    default:
      base = INBOUND_ASSISTANT_PROMPT;
      break;
  }

  if (purpose) {
    return `${base}\n\nCall purpose: ${purpose}`;
  }
  return base;
}

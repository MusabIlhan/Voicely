import type { GeminiToolConfig } from "../../shared/types";

/**
 * Tool schemas in the format Gemini expects (FunctionDeclaration objects).
 * These are passed to the Gemini Live session config so the model can
 * invoke them mid-conversation.
 */

export const checkCalendarAvailability: GeminiToolConfig = {
  name: "check_calendar_availability",
  description:
    "Check if the user has availability on their calendar for a given date and time range",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "The date to check availability for (YYYY-MM-DD format)",
      },
      time_start: {
        type: "string",
        description: "Start time of the range (HH:MM format, 24-hour)",
      },
      time_end: {
        type: "string",
        description: "End time of the range (HH:MM format, 24-hour)",
      },
    },
    required: ["date", "time_start", "time_end"],
  },
};

export const createCalendarEvent: GeminiToolConfig = {
  name: "create_calendar_event",
  description: "Create a new event on the user's calendar",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Title of the calendar event",
      },
      date: {
        type: "string",
        description: "Date of the event (YYYY-MM-DD format)",
      },
      time_start: {
        type: "string",
        description: "Start time of the event (HH:MM format, 24-hour)",
      },
      time_end: {
        type: "string",
        description: "End time of the event (HH:MM format, 24-hour)",
      },
      description: {
        type: "string",
        description: "Optional description for the event",
      },
      location: {
        type: "string",
        description: "Optional location for the event",
      },
    },
    required: ["title", "date", "time_start", "time_end"],
  },
};

export const makeOutboundCall: GeminiToolConfig = {
  name: "make_outbound_call",
  description: "Initiate an outbound phone call to a business or person",
  parameters: {
    type: "object",
    properties: {
      phone_number: {
        type: "string",
        description: "The phone number to call (E.164 format preferred)",
      },
      purpose: {
        type: "string",
        description:
          "The purpose of the call, e.g. 'Make a dinner reservation for 2 at 7pm'",
      },
    },
    required: ["phone_number", "purpose"],
  },
};

export const searchBusiness: GeminiToolConfig = {
  name: "search_business",
  description:
    "Search for a business like a restaurant, salon, or service provider",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query, e.g. 'Italian restaurant' or 'hair salon'",
      },
      location: {
        type: "string",
        description: "Optional location to search near, e.g. 'San Francisco'",
      },
    },
    required: ["query"],
  },
};

export const endCall: GeminiToolConfig = {
  name: "end_call",
  description: "End the current phone call politely",
  parameters: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description:
          "The reason for ending the call, e.g. 'User requested to hang up'",
      },
    },
    required: ["reason"],
  },
};

export const joinMeeting: GeminiToolConfig = {
  name: "join_meeting",
  description:
    "Send the Voisli AI assistant to join a Google Meet meeting",
  parameters: {
    type: "object",
    properties: {
      meeting_url: {
        type: "string",
        description:
          "The Google Meet meeting URL to join (e.g. https://meet.google.com/abc-defg-hij)",
      },
      bot_name: {
        type: "string",
        description:
          "Optional custom name for the meeting bot (defaults to 'Voisli Assistant')",
      },
    },
    required: ["meeting_url"],
  },
};

/** All tool schemas, ready to pass into GeminiConfig.tools */
export const allToolSchemas: GeminiToolConfig[] = [
  checkCalendarAvailability,
  createCalendarEvent,
  makeOutboundCall,
  searchBusiness,
  endCall,
  joinMeeting,
];

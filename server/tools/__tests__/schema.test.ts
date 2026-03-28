import { describe, it, expect } from "vitest";
import {
  allToolSchemas,
  checkCalendarAvailability,
  createCalendarEvent,
  makeOutboundCall,
  searchBusiness,
  endCall,
  joinMeeting,
} from "../schema";

const VALID_PARAM_TYPES = ["string", "number", "integer", "boolean", "object", "array"];

describe("allToolSchemas", () => {
  it("should contain exactly 6 tool schemas", () => {
    expect(allToolSchemas).toHaveLength(6);
  });

  it("should include all expected tool names", () => {
    const names = allToolSchemas.map((s) => s.name);
    expect(names).toContain("check_calendar_availability");
    expect(names).toContain("create_calendar_event");
    expect(names).toContain("make_outbound_call");
    expect(names).toContain("search_business");
    expect(names).toContain("end_call");
    expect(names).toContain("join_meeting");
  });

  it("every schema should have name, description, and parameters", () => {
    for (const schema of allToolSchemas) {
      expect(schema.name).toBeTruthy();
      expect(typeof schema.name).toBe("string");
      expect(schema.description).toBeTruthy();
      expect(typeof schema.description).toBe("string");
      expect(schema.parameters).toBeDefined();
      expect(typeof schema.parameters).toBe("object");
    }
  });

  it("every schema parameters should have type 'object' and properties", () => {
    for (const schema of allToolSchemas) {
      const params = schema.parameters as Record<string, unknown>;
      expect(params.type).toBe("object");
      expect(params.properties).toBeDefined();
      expect(typeof params.properties).toBe("object");
    }
  });

  it("every schema should have a required array", () => {
    for (const schema of allToolSchemas) {
      const params = schema.parameters as Record<string, unknown>;
      expect(Array.isArray(params.required)).toBe(true);
      expect((params.required as string[]).length).toBeGreaterThan(0);
    }
  });

  it("every property should have a valid Gemini type and description", () => {
    for (const schema of allToolSchemas) {
      const params = schema.parameters as Record<string, unknown>;
      const properties = params.properties as Record<string, Record<string, unknown>>;

      for (const [propName, propDef] of Object.entries(properties)) {
        expect(VALID_PARAM_TYPES).toContain(propDef.type);
        expect(propDef.description).toBeTruthy();
        expect(typeof propDef.description).toBe("string");
      }
    }
  });

  it("required fields should reference existing properties", () => {
    for (const schema of allToolSchemas) {
      const params = schema.parameters as Record<string, unknown>;
      const properties = params.properties as Record<string, unknown>;
      const required = params.required as string[];

      for (const field of required) {
        expect(properties).toHaveProperty(field);
      }
    }
  });
});

describe("checkCalendarAvailability schema", () => {
  it("requires date, time_start, and time_end", () => {
    const params = checkCalendarAvailability.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toEqual(["date", "time_start", "time_end"]);
  });

  it("has exactly 3 string parameters", () => {
    const props = (checkCalendarAvailability.parameters as Record<string, unknown>).properties as Record<string, Record<string, unknown>>;
    const keys = Object.keys(props);
    expect(keys).toHaveLength(3);
    for (const key of keys) {
      expect(props[key].type).toBe("string");
    }
  });
});

describe("createCalendarEvent schema", () => {
  it("requires title, date, time_start, and time_end", () => {
    const params = createCalendarEvent.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toEqual(["title", "date", "time_start", "time_end"]);
  });

  it("has optional description and location params", () => {
    const params = createCalendarEvent.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, Record<string, unknown>>;
    const required = params.required as string[];

    expect(props).toHaveProperty("description");
    expect(props).toHaveProperty("location");
    expect(required).not.toContain("description");
    expect(required).not.toContain("location");
  });

  it("has 6 total parameters", () => {
    const props = (createCalendarEvent.parameters as Record<string, unknown>).properties as Record<string, unknown>;
    expect(Object.keys(props)).toHaveLength(6);
  });
});

describe("makeOutboundCall schema", () => {
  it("requires phone_number and purpose", () => {
    const params = makeOutboundCall.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toEqual(["phone_number", "purpose"]);
  });

  it("has exactly 2 parameters", () => {
    const props = (makeOutboundCall.parameters as Record<string, unknown>).properties as Record<string, unknown>;
    expect(Object.keys(props)).toHaveLength(2);
  });
});

describe("searchBusiness schema", () => {
  it("requires only query", () => {
    const params = searchBusiness.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toEqual(["query"]);
  });

  it("has optional location param", () => {
    const params = searchBusiness.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, Record<string, unknown>>;
    const required = params.required as string[];

    expect(props).toHaveProperty("location");
    expect(required).not.toContain("location");
  });
});

describe("endCall schema", () => {
  it("requires reason", () => {
    const params = endCall.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toEqual(["reason"]);
  });

  it("has exactly 1 parameter", () => {
    const props = (endCall.parameters as Record<string, unknown>).properties as Record<string, unknown>;
    expect(Object.keys(props)).toHaveLength(1);
  });
});

describe("joinMeeting schema", () => {
  it("requires meeting_url", () => {
    const params = joinMeeting.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toEqual(["meeting_url"]);
  });

  it("has optional bot_name param", () => {
    const params = joinMeeting.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, Record<string, unknown>>;
    const required = params.required as string[];

    expect(props).toHaveProperty("bot_name");
    expect(required).not.toContain("bot_name");
  });

  it("has exactly 2 parameters", () => {
    const props = (joinMeeting.parameters as Record<string, unknown>).properties as Record<string, unknown>;
    expect(Object.keys(props)).toHaveLength(2);
  });
});

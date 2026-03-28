import { describe, expect, it } from "vitest";
import { parseAssistResponse } from "./mainAgentClient";

describe("parseAssistResponse", () => {
  it("accepts strict well-formed assist responses", () => {
    expect(parseAssistResponse({ turn_id: "session-1:4", say: "hello", should_end_session: false })).toEqual({
      turn_id: "session-1:4",
      say: "hello",
      should_end_session: false,
      metadata: undefined,
    });
  });

  it("fails fast on malformed responses", () => {
    expect(() => parseAssistResponse({ say: 123 })).toThrow(/Malformed \/assist response/);
  });
});

import { describe, it, expect } from "vitest";
import {
  INBOUND_ASSISTANT_PROMPT,
  OUTBOUND_RESERVATION_PROMPT,
  OUTBOUND_GENERIC_PROMPT,
  getSystemPrompt,
} from "./prompts";

describe("system prompts", () => {
  it("should have non-empty prompt constants", () => {
    expect(INBOUND_ASSISTANT_PROMPT.length).toBeGreaterThan(0);
    expect(OUTBOUND_RESERVATION_PROMPT.length).toBeGreaterThan(0);
    expect(OUTBOUND_GENERIC_PROMPT.length).toBeGreaterThan(0);
  });

  it("should mention Voisli in the inbound prompt", () => {
    expect(INBOUND_ASSISTANT_PROMPT).toContain("Voisli");
  });

  it("should mention reservation in the outbound reservation prompt", () => {
    expect(OUTBOUND_RESERVATION_PROMPT.toLowerCase()).toContain("reservation");
  });
});

describe("getSystemPrompt", () => {
  it("should return inbound prompt for inbound context", () => {
    const prompt = getSystemPrompt("inbound");
    expect(prompt).toBe(INBOUND_ASSISTANT_PROMPT);
  });

  it("should return reservation prompt for outbound_reservation context", () => {
    const prompt = getSystemPrompt("outbound_reservation");
    expect(prompt).toBe(OUTBOUND_RESERVATION_PROMPT);
  });

  it("should return generic outbound prompt for outbound_generic context", () => {
    const prompt = getSystemPrompt("outbound_generic");
    expect(prompt).toBe(OUTBOUND_GENERIC_PROMPT);
  });

  it("should append purpose when provided", () => {
    const prompt = getSystemPrompt("inbound", "Check calendar availability");
    expect(prompt).toContain(INBOUND_ASSISTANT_PROMPT);
    expect(prompt).toContain("Call purpose: Check calendar availability");
  });

  it("should not append purpose line when purpose is empty", () => {
    const prompt = getSystemPrompt("outbound_generic");
    expect(prompt).not.toContain("Call purpose:");
  });

  it("should append purpose to outbound reservation prompt", () => {
    const prompt = getSystemPrompt(
      "outbound_reservation",
      "Dinner for 4 at 7pm Saturday"
    );
    expect(prompt).toContain(OUTBOUND_RESERVATION_PROMPT);
    expect(prompt).toContain("Dinner for 4 at 7pm Saturday");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MeetingContextManager } from "../contextManager";
import type { TranscriptEntry } from "../types";

function makeEntry(
  speaker: string,
  text: string,
  timestamp?: Date
): TranscriptEntry {
  return { speaker, text, timestamp: timestamp ?? new Date() };
}

describe("MeetingContextManager", () => {
  let ctx: MeetingContextManager;

  beforeEach(() => {
    ctx = new MeetingContextManager();
  });

  // -------------------------------------------------------------------------
  // addTranscriptEntry + getTranscript
  // -------------------------------------------------------------------------

  describe("addTranscriptEntry", () => {
    it("stores entries and returns them in order", () => {
      ctx.addTranscriptEntry(makeEntry("Alice", "Hello everyone"));
      ctx.addTranscriptEntry(makeEntry("Bob", "Hi Alice"));

      const transcript = ctx.getTranscript();
      expect(transcript).toHaveLength(2);
      expect(transcript[0].speaker).toBe("Alice");
      expect(transcript[1].speaker).toBe("Bob");
    });

    it("tracks participants automatically", () => {
      ctx.addTranscriptEntry(makeEntry("Alice", "Hello"));
      ctx.addTranscriptEntry(makeEntry("Bob", "Hi"));
      ctx.addTranscriptEntry(makeEntry("Alice", "How are you?"));

      const participants = ctx.getParticipants();
      expect(participants).toHaveLength(2);
      expect(participants.map((p) => p.name).sort()).toEqual(["Alice", "Bob"]);
    });
  });

  // -------------------------------------------------------------------------
  // Rolling window trimming
  // -------------------------------------------------------------------------

  describe("rolling window", () => {
    it("trims entries beyond maxEntries", () => {
      ctx = new MeetingContextManager({ maxEntries: 3 });

      ctx.addTranscriptEntry(makeEntry("A", "One"));
      ctx.addTranscriptEntry(makeEntry("B", "Two"));
      ctx.addTranscriptEntry(makeEntry("C", "Three"));
      ctx.addTranscriptEntry(makeEntry("D", "Four"));

      const transcript = ctx.getTranscript();
      expect(transcript).toHaveLength(3);
      expect(transcript[0].speaker).toBe("B");
      expect(transcript[2].speaker).toBe("D");
    });

    it("trims entries older than maxAgeMinutes", () => {
      ctx = new MeetingContextManager({ maxAgeMinutes: 5 });

      const oldTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const recentTime = new Date(); // now

      ctx.addTranscriptEntry(makeEntry("Old", "Ancient message", oldTime));
      ctx.addTranscriptEntry(makeEntry("New", "Fresh message", recentTime));

      // The old entry should be trimmed after adding the new one
      const transcript = ctx.getTranscript();
      expect(transcript).toHaveLength(1);
      expect(transcript[0].speaker).toBe("New");
    });
  });

  // -------------------------------------------------------------------------
  // getContext
  // -------------------------------------------------------------------------

  describe("getContext", () => {
    it("returns formatted context with participants and conversation", () => {
      ctx.addTranscriptEntry(makeEntry("Alice", "Let's discuss the roadmap"));
      ctx.addTranscriptEntry(makeEntry("Bob", "I agree, we need to prioritize"));

      const context = ctx.getContext();
      expect(context).toContain("Participants: Alice, Bob");
      expect(context).toContain("Recent Conversation");
      expect(context).toContain("Alice: Let's discuss the roadmap");
      expect(context).toContain("Bob: I agree, we need to prioritize");
      expect(context).toContain("Speaker Activity");
    });

    it("returns empty-ish context when no entries exist", () => {
      const context = ctx.getContext();
      // No participants, no conversation
      expect(context).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // getSummary
  // -------------------------------------------------------------------------

  describe("getSummary", () => {
    it("returns 'no entries' when transcript is empty", () => {
      expect(ctx.getSummary()).toBe("No transcript entries yet.");
    });

    it("includes duration, participants, and speaker breakdown", () => {
      const t1 = new Date(Date.now() - 5 * 60 * 1000);
      const t2 = new Date();

      ctx.addTranscriptEntry(makeEntry("Alice", "First thing", t1));
      ctx.addTranscriptEntry(makeEntry("Bob", "Second thing here now", t2));

      const summary = ctx.getSummary();
      expect(summary).toContain("Meeting duration:");
      expect(summary).toContain("Participants (2): Alice, Bob");
      expect(summary).toContain("Speaker breakdown:");
      expect(summary).toContain("Alice:");
      expect(summary).toContain("Bob:");
      expect(summary).toContain("Total transcript entries: 2");
    });
  });

  // -------------------------------------------------------------------------
  // detectBotMention
  // -------------------------------------------------------------------------

  describe("detectBotMention", () => {
    it("detects 'Voisli' mention (case insensitive)", () => {
      expect(
        ctx.detectBotMention(makeEntry("Alice", "Hey Voisli, what time is it?"))
      ).toBe(true);
      expect(
        ctx.detectBotMention(makeEntry("Alice", "Can voisli answer that?"))
      ).toBe(true);
      expect(
        ctx.detectBotMention(makeEntry("Alice", "VOISLI help me"))
      ).toBe(true);
    });

    it("detects 'hey assistant' pattern", () => {
      expect(
        ctx.detectBotMention(makeEntry("Bob", "Hey assistant, check the calendar"))
      ).toBe(true);
    });

    it("detects 'hi assistant' pattern", () => {
      expect(
        ctx.detectBotMention(makeEntry("Bob", "Hi assistant, what's next?"))
      ).toBe(true);
    });

    it("detects 'ok assistant' pattern", () => {
      expect(
        ctx.detectBotMention(makeEntry("Bob", "Ok assistant, schedule that"))
      ).toBe(true);
    });

    it("detects 'can the bot' pattern", () => {
      expect(
        ctx.detectBotMention(makeEntry("Carol", "Can the bot answer that question?"))
      ).toBe(true);
    });

    it("detects 'could bot' pattern", () => {
      expect(
        ctx.detectBotMention(makeEntry("Carol", "Could bot look that up?"))
      ).toBe(true);
    });

    it("detects 'ask the bot' pattern", () => {
      expect(
        ctx.detectBotMention(makeEntry("Dan", "Let's ask the bot about it"))
      ).toBe(true);
    });

    it("detects 'bot, ...' with a question mark", () => {
      expect(
        ctx.detectBotMention(makeEntry("Eve", "bot, when is the deadline?"))
      ).toBe(true);
    });

    it("does not false-positive on normal conversation", () => {
      expect(
        ctx.detectBotMention(makeEntry("Alice", "I think we should ship next week"))
      ).toBe(false);
      expect(
        ctx.detectBotMention(makeEntry("Bob", "The robot arm is broken"))
      ).toBe(false);
      expect(
        ctx.detectBotMention(makeEntry("Carol", "Let's get the about page done"))
      ).toBe(false);
    });

    it("does not match 'bot' without question context", () => {
      expect(
        ctx.detectBotMention(makeEntry("Alice", "The bot is in the meeting"))
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Speaker stats
  // -------------------------------------------------------------------------

  describe("getSpeakerStats", () => {
    it("tracks per-speaker entry count and word count", () => {
      ctx.addTranscriptEntry(makeEntry("Alice", "Hello world"));
      ctx.addTranscriptEntry(makeEntry("Alice", "How are you"));
      ctx.addTranscriptEntry(makeEntry("Bob", "Fine thanks"));

      const stats = ctx.getSpeakerStats();
      expect(stats).toHaveLength(2);

      const alice = stats.find((s) => s.name === "Alice")!;
      expect(alice.entryCount).toBe(2);
      expect(alice.wordCount).toBe(5); // "Hello world" + "How are you"

      const bob = stats.find((s) => s.name === "Bob")!;
      expect(bob.entryCount).toBe(1);
      expect(bob.wordCount).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // getEntryCount
  // -------------------------------------------------------------------------

  describe("getEntryCount", () => {
    it("returns 0 for new instance", () => {
      expect(ctx.getEntryCount()).toBe(0);
    });

    it("returns correct count after adding entries", () => {
      ctx.addTranscriptEntry(makeEntry("A", "One"));
      ctx.addTranscriptEntry(makeEntry("B", "Two"));
      expect(ctx.getEntryCount()).toBe(2);
    });
  });
});

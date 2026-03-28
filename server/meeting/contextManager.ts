import type { TranscriptEntry, MeetingParticipant } from "./types.js";

// ---------------------------------------------------------------------------
// Meeting context manager — maintains a rolling window of the conversation
// and provides formatted context for the AI brain.
// ---------------------------------------------------------------------------

export interface SpeakerStats {
  name: string;
  speakerId: string;
  entryCount: number;
  wordCount: number;
}

export interface ContextManagerOptions {
  /** Maximum number of transcript entries to keep in the rolling window */
  maxEntries?: number;
  /** Maximum age (in minutes) of transcript entries to keep */
  maxAgeMinutes?: number;
}

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_MAX_AGE_MINUTES = 30;

export class MeetingContextManager {
  private transcript: TranscriptEntry[] = [];
  private participants: Map<string, MeetingParticipant> = new Map();
  private speakerStats: Map<string, SpeakerStats> = new Map();
  private maxEntries: number;
  private maxAgeMinutes: number;

  constructor(options: ContextManagerOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.maxAgeMinutes = options.maxAgeMinutes ?? DEFAULT_MAX_AGE_MINUTES;
  }

  /**
   * Add a new transcript line with speaker attribution.
   */
  addTranscriptEntry(entry: TranscriptEntry): void {
    this.transcript.push(entry);

    // Track participant
    if (!this.participants.has(entry.speaker)) {
      this.participants.set(entry.speaker, {
        name: entry.speaker,
        speakerId: entry.speaker,
      });
    }

    // Update speaker stats
    const existing = this.speakerStats.get(entry.speaker);
    const words = entry.text.trim().split(/\s+/).filter(Boolean).length;

    if (existing) {
      existing.entryCount += 1;
      existing.wordCount += words;
    } else {
      this.speakerStats.set(entry.speaker, {
        name: entry.speaker,
        speakerId: entry.speaker,
        entryCount: 1,
        wordCount: words,
      });
    }

    this.trimWindow();
  }

  /**
   * Returns the formatted meeting context as a string for Gemini.
   * Includes participant list, recent conversation, and detected topics.
   */
  getContext(): string {
    const parts: string[] = [];

    // Participants
    const participantNames = Array.from(this.participants.values())
      .map((p) => p.name);
    if (participantNames.length > 0) {
      parts.push(`Participants: ${participantNames.join(", ")}`);
    }

    // Recent conversation
    const window = this.getWindow();
    if (window.length > 0) {
      parts.push("--- Recent Conversation ---");
      for (const entry of window) {
        const time = entry.timestamp.toISOString().substring(11, 19);
        parts.push(`[${time}] ${entry.speaker}: ${entry.text}`);
      }
    }

    // Speaker stats
    if (this.speakerStats.size > 0) {
      parts.push("--- Speaker Activity ---");
      for (const stats of this.speakerStats.values()) {
        parts.push(`${stats.name}: ${stats.entryCount} messages, ${stats.wordCount} words`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Generates a concise summary of the meeting so far
   * (topics discussed, key points, speaker breakdown).
   */
  getSummary(): string {
    const window = this.getWindow();
    if (window.length === 0) {
      return "No transcript entries yet.";
    }

    const parts: string[] = [];

    // Duration
    const first = window[0].timestamp;
    const last = window[window.length - 1].timestamp;
    const durationMinutes = Math.round(
      (last.getTime() - first.getTime()) / 60000
    );
    parts.push(`Meeting duration: ~${durationMinutes} minute(s)`);

    // Participants
    const participantNames = Array.from(this.participants.values())
      .map((p) => p.name);
    parts.push(`Participants (${participantNames.length}): ${participantNames.join(", ")}`);

    // Speaker breakdown
    parts.push("Speaker breakdown:");
    const sortedStats = Array.from(this.speakerStats.values())
      .sort((a, b) => b.wordCount - a.wordCount);
    for (const stats of sortedStats) {
      parts.push(
        `  - ${stats.name}: ${stats.entryCount} messages, ${stats.wordCount} words`
      );
    }

    // Total entries
    parts.push(`Total transcript entries: ${this.transcript.length}`);

    return parts.join("\n");
  }

  /**
   * Checks if the latest transcript entry is addressing the bot.
   * Matches: "Voisli", "hey assistant", "bot", or direct question patterns.
   */
  detectBotMention(entry: TranscriptEntry): boolean {
    const text = entry.text.toLowerCase();

    // Direct name mentions
    if (text.includes("voisli")) return true;

    // Assistant references
    if (/\bhey\s+assistant\b/.test(text)) return true;
    if (/\bhi\s+assistant\b/.test(text)) return true;
    if (/\bok\s+assistant\b/.test(text)) return true;

    // Bot references with question context
    if (/\b(can|could|would|will|does|did)\s+(the\s+)?bot\b/.test(text)) return true;
    if (/\bask\s+(the\s+)?bot\b/.test(text)) return true;
    if (/\bbot,?\s/.test(text) && text.includes("?")) return true;

    return false;
  }

  /**
   * Returns per-speaker statistics.
   */
  getSpeakerStats(): SpeakerStats[] {
    return Array.from(this.speakerStats.values());
  }

  /**
   * Returns the list of detected participants.
   */
  getParticipants(): MeetingParticipant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Returns all transcript entries within the rolling window.
   */
  getTranscript(): TranscriptEntry[] {
    return [...this.transcript];
  }

  /**
   * Returns the number of entries in the current window.
   */
  getEntryCount(): number {
    return this.transcript.length;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private getWindow(): TranscriptEntry[] {
    const cutoff = new Date(Date.now() - this.maxAgeMinutes * 60 * 1000);
    return this.transcript.filter((e) => e.timestamp >= cutoff);
  }

  private trimWindow(): void {
    // Trim by count
    if (this.transcript.length > this.maxEntries) {
      this.transcript = this.transcript.slice(
        this.transcript.length - this.maxEntries
      );
    }

    // Trim by age
    const cutoff = new Date(Date.now() - this.maxAgeMinutes * 60 * 1000);
    const firstValid = this.transcript.findIndex((e) => e.timestamp >= cutoff);
    if (firstValid > 0) {
      this.transcript = this.transcript.slice(firstValid);
    }
  }
}

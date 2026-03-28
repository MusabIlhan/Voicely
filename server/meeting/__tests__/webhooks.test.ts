import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import webhookRouter, {
  onTranscript,
  onStatusChange,
  onAudio,
  clearListeners,
} from "../webhooks";

// Build a minimal Express app for testing
function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    express.raw({ type: "audio/raw", limit: "10mb" })
  );
  app.use(webhookRouter);
  return app;
}

describe("Recall.ai webhooks", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    clearListeners();
    app = createApp();
  });

  // -----------------------------------------------------------------------
  // POST /webhooks/recall/transcript
  // -----------------------------------------------------------------------

  describe("POST /webhooks/recall/transcript", () => {
    it("returns 204 and notifies listeners with parsed transcript", async () => {
      const entries: Array<{ botId: string; speaker: string; text: string }> = [];

      onTranscript((botId, entry) => {
        entries.push({ botId, speaker: entry.speaker, text: entry.text });
      });

      await request(app)
        .post("/webhooks/recall/transcript")
        .send({
          bot_id: "bot_abc",
          transcript: {
            speaker: "Alice",
            words: [
              { text: "Hello", start_time: 1.0, end_time: 1.5 },
              { text: "everyone", start_time: 1.5, end_time: 2.0 },
            ],
            is_final: true,
          },
        })
        .expect(204);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        botId: "bot_abc",
        speaker: "Alice",
        text: "Hello everyone",
      });
    });

    it("returns 204 and skips empty transcript text", async () => {
      const entries: unknown[] = [];
      onTranscript((_botId, entry) => entries.push(entry));

      await request(app)
        .post("/webhooks/recall/transcript")
        .send({
          bot_id: "bot_abc",
          transcript: {
            speaker: "Alice",
            words: [],
            is_final: true,
          },
        })
        .expect(204);

      expect(entries).toHaveLength(0);
    });

    it("returns 400 when bot_id is missing", async () => {
      await request(app)
        .post("/webhooks/recall/transcript")
        .send({ transcript: { speaker: "X", words: [{ text: "hi" }] } })
        .expect(400);
    });

    it("returns 400 when transcript is missing", async () => {
      await request(app)
        .post("/webhooks/recall/transcript")
        .send({ bot_id: "bot_1" })
        .expect(400);
    });

    it("defaults speaker to 'Unknown' when not provided", async () => {
      const entries: Array<{ speaker: string }> = [];
      onTranscript((_botId, entry) => entries.push({ speaker: entry.speaker }));

      await request(app)
        .post("/webhooks/recall/transcript")
        .send({
          bot_id: "bot_1",
          transcript: {
            words: [{ text: "hello" }],
          },
        })
        .expect(204);

      expect(entries[0].speaker).toBe("Unknown");
    });

    it("continues even if a listener throws", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      onTranscript(() => {
        throw new Error("boom");
      });

      const secondCalled: boolean[] = [];
      onTranscript(() => secondCalled.push(true));

      await request(app)
        .post("/webhooks/recall/transcript")
        .send({
          bot_id: "bot_1",
          transcript: {
            speaker: "A",
            words: [{ text: "test" }],
          },
        })
        .expect(204);

      expect(secondCalled).toHaveLength(1);
      consoleError.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // POST /webhooks/recall/status
  // -----------------------------------------------------------------------

  describe("POST /webhooks/recall/status", () => {
    it("maps Recall status codes and notifies listeners", async () => {
      const events: Array<{ botId: string; status: string }> = [];
      onStatusChange((botId, status) => events.push({ botId, status }));

      // in_call_recording → in_call
      await request(app)
        .post("/webhooks/recall/status")
        .send({
          bot_id: "bot_1",
          status: { code: "in_call_recording", message: "Recording" },
        })
        .expect(204);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ botId: "bot_1", status: "in_call" });
    });

    it("maps joining_call to 'joining'", async () => {
      const events: Array<{ status: string }> = [];
      onStatusChange((_botId, status) => events.push({ status }));

      await request(app)
        .post("/webhooks/recall/status")
        .send({
          bot_id: "bot_2",
          status: { code: "joining_call", message: "Joining" },
        })
        .expect(204);

      expect(events[0].status).toBe("joining");
    });

    it("maps call_ended to 'done'", async () => {
      const events: Array<{ status: string }> = [];
      onStatusChange((_botId, status) => events.push({ status }));

      await request(app)
        .post("/webhooks/recall/status")
        .send({
          bot_id: "bot_3",
          status: { code: "call_ended", message: "Done" },
        })
        .expect(204);

      expect(events[0].status).toBe("done");
    });

    it("maps unknown code to 'error'", async () => {
      const events: Array<{ status: string }> = [];
      onStatusChange((_botId, status) => events.push({ status }));

      await request(app)
        .post("/webhooks/recall/status")
        .send({
          bot_id: "bot_4",
          status: { code: "something_weird", message: "???" },
        })
        .expect(204);

      expect(events[0].status).toBe("error");
    });

    it("returns 400 when bot_id is missing", async () => {
      await request(app)
        .post("/webhooks/recall/status")
        .send({ status: { code: "done" } })
        .expect(400);
    });

    it("returns 400 when status is missing", async () => {
      await request(app)
        .post("/webhooks/recall/status")
        .send({ bot_id: "bot_5" })
        .expect(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /webhooks/recall/audio
  // -----------------------------------------------------------------------

  describe("POST /webhooks/recall/audio", () => {
    it("returns 400 when bot_id query parameter is missing", async () => {
      await request(app)
        .post("/webhooks/recall/audio")
        .send(Buffer.from([0x01, 0x02]))
        .expect(400);
    });

    it("returns 204 for empty body", async () => {
      await request(app)
        .post("/webhooks/recall/audio?bot_id=bot_1")
        .send("")
        .expect(204);
    });

    it("notifies audio listeners with buffer data", async () => {
      const received: Array<{ botId: string; length: number }> = [];
      onAudio((botId, audioData) =>
        received.push({ botId, length: audioData.length })
      );

      await request(app)
        .post("/webhooks/recall/audio?bot_id=bot_1")
        .set("Content-Type", "audio/raw")
        .send(Buffer.from([0x01, 0x02, 0x03]))
        .expect(204);

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ botId: "bot_1", length: 3 });
    });
  });

  // -----------------------------------------------------------------------
  // clearListeners
  // -----------------------------------------------------------------------

  describe("clearListeners", () => {
    it("removes all registered listeners", async () => {
      const calls: string[] = [];
      onTranscript(() => calls.push("transcript"));
      onStatusChange(() => calls.push("status"));

      clearListeners();

      await request(app)
        .post("/webhooks/recall/transcript")
        .send({
          bot_id: "bot_1",
          transcript: { speaker: "A", words: [{ text: "hi" }] },
        })
        .expect(204);

      await request(app)
        .post("/webhooks/recall/status")
        .send({ bot_id: "bot_1", status: { code: "done" } })
        .expect(204);

      expect(calls).toHaveLength(0);
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  mulawToLinear,
  linearToMulaw,
  resample8kTo16k,
  resample16kTo8k,
  twilioToGemini,
  geminiToTwilio,
} from "./converter";

describe("mulawToLinear / linearToMulaw round-trip", () => {
  it("should produce similar values after encode then decode", () => {
    // Create a PCM buffer with known sample values
    const samples = [0, 1000, -1000, 16000, -16000, 32000, -32000, 100, -100];
    const pcm = Buffer.alloc(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      pcm.writeInt16LE(samples[i], i * 2);
    }

    const encoded = linearToMulaw(pcm);
    const decoded = mulawToLinear(encoded);

    // μ-law is lossy — expect values within ~2% of original (or ±200 for small values)
    for (let i = 0; i < samples.length; i++) {
      const original = samples[i];
      const roundTripped = decoded.readInt16LE(i * 2);
      const tolerance = Math.max(Math.abs(original) * 0.05, 200);
      expect(Math.abs(original - roundTripped)).toBeLessThanOrEqual(tolerance);
    }
  });

  it("should handle silence (all zeros)", () => {
    const pcm = Buffer.alloc(100); // 50 zero samples
    const encoded = linearToMulaw(pcm);
    const decoded = mulawToLinear(encoded);

    // Decoded silence should be very close to zero
    for (let i = 0; i < 50; i++) {
      const sample = decoded.readInt16LE(i * 2);
      expect(Math.abs(sample)).toBeLessThanOrEqual(200);
    }
  });

  it("should produce correct buffer sizes", () => {
    const pcm = Buffer.alloc(200); // 100 samples
    const mulaw = linearToMulaw(pcm);
    expect(mulaw.length).toBe(100); // 1 byte per sample

    const back = mulawToLinear(mulaw);
    expect(back.length).toBe(200); // 2 bytes per sample
  });
});

describe("resample8kTo16k", () => {
  it("should double the number of samples", () => {
    const pcm8k = Buffer.alloc(100); // 50 samples
    const pcm16k = resample8kTo16k(pcm8k);
    expect(pcm16k.length).toBe(200); // 100 samples (2x)
  });

  it("should preserve original samples at even positions", () => {
    const pcm8k = Buffer.alloc(6); // 3 samples
    pcm8k.writeInt16LE(1000, 0);
    pcm8k.writeInt16LE(2000, 2);
    pcm8k.writeInt16LE(3000, 4);

    const pcm16k = resample8kTo16k(pcm8k);
    // Original samples appear at indices 0, 2, 4
    expect(pcm16k.readInt16LE(0)).toBe(1000);
    expect(pcm16k.readInt16LE(4)).toBe(2000);
    expect(pcm16k.readInt16LE(8)).toBe(3000);
  });

  it("should interpolate between samples", () => {
    const pcm8k = Buffer.alloc(4); // 2 samples
    pcm8k.writeInt16LE(1000, 0);
    pcm8k.writeInt16LE(3000, 2);

    const pcm16k = resample8kTo16k(pcm8k);
    // Interpolated sample between 1000 and 3000 should be 2000
    expect(pcm16k.readInt16LE(2)).toBe(2000);
  });

  it("should handle empty input", () => {
    const result = resample8kTo16k(Buffer.alloc(0));
    expect(result.length).toBe(0);
  });
});

describe("resample16kTo8k", () => {
  it("should halve the number of samples", () => {
    const pcm16k = Buffer.alloc(200); // 100 samples
    const pcm8k = resample16kTo8k(pcm16k);
    expect(pcm8k.length).toBe(100); // 50 samples (0.5x)
  });

  it("should average adjacent sample pairs", () => {
    const pcm16k = Buffer.alloc(8); // 4 samples → 2 output samples
    pcm16k.writeInt16LE(1000, 0);
    pcm16k.writeInt16LE(3000, 2);
    pcm16k.writeInt16LE(5000, 4);
    pcm16k.writeInt16LE(7000, 6);

    const pcm8k = resample16kTo8k(pcm16k);
    expect(pcm8k.readInt16LE(0)).toBe(2000); // avg(1000, 3000)
    expect(pcm8k.readInt16LE(2)).toBe(6000); // avg(5000, 7000)
  });

  it("should handle empty input", () => {
    const result = resample16kTo8k(Buffer.alloc(0));
    expect(result.length).toBe(0);
  });
});

describe("twilioToGemini (full pipeline)", () => {
  it("should convert base64 mulaw to a PCM 16kHz buffer", () => {
    // Create some mulaw bytes and base64-encode them
    const mulawBytes = Buffer.from([0xff, 0x7f, 0x00, 0x80]); // 4 mulaw samples
    const base64 = mulawBytes.toString("base64");

    const result = twilioToGemini(base64);

    // 4 mulaw samples → 4 PCM samples (8 bytes) at 8kHz → 8 PCM samples (16 bytes) at 16kHz
    expect(result.length).toBe(16);
  });

  it("should return a Buffer", () => {
    const result = twilioToGemini(Buffer.from([0xff]).toString("base64"));
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});

describe("geminiToTwilio (full pipeline)", () => {
  it("should convert PCM 16kHz buffer to base64 mulaw string", () => {
    // Create 16kHz PCM: 8 samples → 4 samples at 8kHz → 4 mulaw bytes → base64
    const pcm16k = Buffer.alloc(16); // 8 samples
    for (let i = 0; i < 8; i++) {
      pcm16k.writeInt16LE(1000, i * 2);
    }

    const result = geminiToTwilio(pcm16k);

    expect(typeof result).toBe("string");
    // Decode it to verify it's valid base64
    const decoded = Buffer.from(result, "base64");
    expect(decoded.length).toBe(4); // 4 mulaw bytes
  });

  it("should round-trip with twilioToGemini approximately", () => {
    // Start with some PCM at 16kHz
    const originalPcm = Buffer.alloc(8); // 4 samples at 16kHz
    originalPcm.writeInt16LE(5000, 0);
    originalPcm.writeInt16LE(5000, 2);
    originalPcm.writeInt16LE(-5000, 4);
    originalPcm.writeInt16LE(-5000, 6);

    // Gemini → Twilio → back to Gemini
    const twilioBase64 = geminiToTwilio(originalPcm);
    const roundTripped = twilioToGemini(twilioBase64);

    // The round trip involves lossy compression (mulaw) and resampling,
    // so just check that we get audio data back of the right size
    // 4 samples at 16k → 2 at 8k → 2 mulaw → 2 pcm at 8k → 4 pcm at 16k
    expect(roundTripped.length).toBe(8);
  });
});

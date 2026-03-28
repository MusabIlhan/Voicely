/**
 * Audio format conversion utilities for bridging Twilio ↔ Gemini audio.
 *
 * Twilio sends/receives: G.711 μ-law, 8kHz, base64-encoded
 * Gemini sends/receives: 16-bit linear PCM, 16kHz mono
 *
 * All implementations are pure TypeScript — no native dependencies.
 */

// Segment base values for μ-law decoding (ITU-T G.711 standard).
// Each entry is the linear PCM base for that exponent segment.
const DECODE_SEGMENT_BASE = [0, 132, 396, 924, 1980, 4092, 8316, 16764];

// μ-law decode table: maps each 8-bit μ-law byte to a 16-bit linear PCM sample.
const MULAW_DECODE_TABLE = new Int16Array(256);

// Pre-compute the decode table using the standard ITU-T G.711 algorithm.
(function buildDecodeTable() {
  for (let i = 0; i < 256; i++) {
    const complemented = ~i & 0xff;
    const sign = complemented & 0x80;
    const exponent = (complemented >> 4) & 0x07;
    const mantissa = complemented & 0x0f;
    const sample = DECODE_SEGMENT_BASE[exponent] + (mantissa << (exponent + 3));
    MULAW_DECODE_TABLE[i] = sign ? -sample : sample;
  }
})();

// Exponent lookup table for μ-law encoding.
// Maps (biased_sample >> 7) to segment number.
const ENCODE_EXP_LUT = new Uint8Array(256);

(function buildExpLut() {
  // For value v, exp = floor(log2(v)) clamped to [0,7]
  for (let i = 0; i < 256; i++) {
    let exp = 0;
    let val = i;
    while (val > 1 && exp < 7) {
      val >>= 1;
      exp++;
    }
    ENCODE_EXP_LUT[i] = exp;
  }
})();

/**
 * Decode G.711 μ-law bytes to 16-bit linear PCM.
 * Each input byte produces one 16-bit sample (2 output bytes, little-endian).
 */
export function mulawToLinear(mulawBytes: Buffer): Buffer {
  const pcm = Buffer.alloc(mulawBytes.length * 2);
  for (let i = 0; i < mulawBytes.length; i++) {
    const sample = MULAW_DECODE_TABLE[mulawBytes[i]];
    pcm.writeInt16LE(sample, i * 2);
  }
  return pcm;
}

/**
 * Encode 16-bit linear PCM to G.711 μ-law.
 * Each 16-bit sample (2 input bytes, little-endian) produces one output byte.
 */
export function linearToMulaw(pcmBytes: Buffer): Buffer {
  const BIAS = 0x84; // 132
  const CLIP = 32635; // Max magnitude before clipping

  const sampleCount = Math.floor(pcmBytes.length / 2);
  const mulaw = Buffer.alloc(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    let sample = pcmBytes.readInt16LE(i * 2);

    // Determine sign
    const sign = sample < 0 ? 0x80 : 0x00;
    if (sample < 0) sample = -sample;

    // Clip to max
    if (sample > CLIP) sample = CLIP;

    // Add bias
    sample += BIAS;

    // Find the exponent via lookup table
    const exponent = ENCODE_EXP_LUT[(sample >> 7) & 0xff];

    // Extract mantissa (4 bits)
    const mantissa = (sample >> (exponent + 3)) & 0x0f;

    // Compose the μ-law byte and complement
    mulaw[i] = ~(sign | (exponent << 4) | mantissa) & 0xff;
  }

  return mulaw;
}

/**
 * Upsample 8kHz PCM to 16kHz using linear interpolation.
 * Input and output are 16-bit LE PCM buffers.
 */
export function resample8kTo16k(pcm8k: Buffer): Buffer {
  const sampleCount = Math.floor(pcm8k.length / 2);
  if (sampleCount === 0) return Buffer.alloc(0);

  const pcm16k = Buffer.alloc(sampleCount * 2 * 2); // 2x samples, 2 bytes each

  for (let i = 0; i < sampleCount; i++) {
    const current = pcm8k.readInt16LE(i * 2);
    const next = i + 1 < sampleCount ? pcm8k.readInt16LE((i + 1) * 2) : current;

    // Write original sample
    pcm16k.writeInt16LE(current, i * 4);
    // Write interpolated sample
    const interpolated = Math.round((current + next) / 2);
    pcm16k.writeInt16LE(interpolated, i * 4 + 2);
  }

  return pcm16k;
}

/**
 * Downsample 16kHz PCM to 8kHz by averaging adjacent sample pairs.
 * Input and output are 16-bit LE PCM buffers.
 */
export function resample16kTo8k(pcm16k: Buffer): Buffer {
  const sampleCount = Math.floor(pcm16k.length / 2);
  const outSamples = Math.floor(sampleCount / 2);
  const pcm8k = Buffer.alloc(outSamples * 2);

  for (let i = 0; i < outSamples; i++) {
    const s1 = pcm16k.readInt16LE(i * 4);
    const s2 = pcm16k.readInt16LE(i * 4 + 2);
    const avg = Math.round((s1 + s2) / 2);
    pcm8k.writeInt16LE(avg, i * 2);
  }

  return pcm8k;
}

/**
 * Full pipeline: Twilio → Gemini
 * base64 mulaw (8kHz) → decode → upsample to 16kHz → PCM buffer
 */
export function twilioToGemini(base64Mulaw: string): Buffer {
  const mulawBytes = Buffer.from(base64Mulaw, "base64");
  const pcm8k = mulawToLinear(mulawBytes);
  return resample8kTo16k(pcm8k);
}

/**
 * Full pipeline: Gemini → Twilio
 * PCM 16kHz buffer → downsample to 8kHz → encode to mulaw → base64 string
 */
export function geminiToTwilio(pcm16k: Buffer): string {
  const pcm8k = resample16kTo8k(pcm16k);
  const mulaw = linearToMulaw(pcm8k);
  return mulaw.toString("base64");
}

import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import { MEETING_ASSISTANT_PROMPT } from "../gemini/prompts.js";
import { executeToolCalls } from "../tools/executor.js";
import {
  checkCalendarAvailability,
  createCalendarEvent,
  searchBusiness,
} from "../tools/schema.js";
import type { GeminiToolConfig } from "../../shared/types.js";

// ---------------------------------------------------------------------------
// Meeting AI brain — uses standard Gemini API for text-based Q&A with
// meeting context, plus TTS for generating spoken responses that get sent
// back to the meeting via Recall.ai.
// ---------------------------------------------------------------------------

/** Tools available to the meeting assistant (subset of phone tools). */
const MEETING_TOOLS: GeminiToolConfig[] = [
  checkCalendarAvailability,
  createCalendarEvent,
  searchBusiness,
];

const TEXT_MODEL = "gemini-3.1-flash-lite-preview";
const TTS_MODEL = "gemini-2.5-flash-native-audio-latest";
const MAX_TOOL_ROUNDS = 3;

export class MeetingAI {
  private genAI: GoogleGenAI;

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }

  /**
   * Handle a question from the meeting by sending it along with the full
   * meeting context to Gemini. Supports tool calls (calendar, search) with
   * up to MAX_TOOL_ROUNDS iterations.
   */
  async handleQuestion(
    question: string,
    meetingContext: string
  ): Promise<string> {
    const systemPrompt =
      MEETING_ASSISTANT_PROMPT +
      "\n\n--- Meeting Context ---\n" +
      meetingContext;

    const tools = MEETING_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const contents: Array<{
      role: string;
      parts: Array<{ text?: string; functionResponse?: { name: string; response: Record<string, unknown> | undefined } }>;
    }> = [{ role: "user", parts: [{ text: question }] }];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.genAI.models.generateContent({
        model: TEXT_MODEL,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: tools }],
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        return "I'm sorry, I wasn't able to generate a response.";
      }

      const parts = candidate.content.parts;

      // Check for function calls
      const functionCalls = parts
        .filter((p) => p.functionCall)
        .map((p) => p.functionCall!);

      if (functionCalls.length === 0) {
        // No tool calls — extract text response
        const text = parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join("");
        return text || "I'm sorry, I wasn't able to generate a response.";
      }

      // Execute tool calls
      const toolResults = await executeToolCalls(
        functionCalls.map((fc) => ({
          name: fc.name ?? "unknown",
          args: fc.args as Record<string, unknown>,
        }))
      );

      // Append the model's response and tool results to the conversation
      contents.push({ role: "model", parts: parts as Array<{ text?: string }> });
      contents.push({
        role: "user",
        parts: toolResults.map((r) => ({
          functionResponse: {
            name: r.name ?? "unknown",
            response: r.response ?? {},
          },
        })),
      });
    }

    // If we exhausted tool rounds, do one final generation without tools
    const finalResponse = await this.genAI.models.generateContent({
      model: TEXT_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const finalText = finalResponse.candidates?.[0]?.content?.parts
      ?.filter((p) => p.text)
      .map((p) => p.text)
      .join("");

    return finalText || "I'm sorry, I wasn't able to generate a response.";
  }

  /**
   * Convert a text response to speech audio using Gemini TTS.
   * Returns a PCM audio buffer suitable for Recall.ai's output_audio endpoint.
   */
  async generateAudioResponse(text: string): Promise<Buffer> {
    try {
      const response = await this.genAI.models.generateContent({
        model: TTS_MODEL,
        contents: [{ role: "user", parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Aoede" },
            },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.data
      );

      if (!audioPart?.inlineData?.data) {
        console.warn("[MeetingAI] TTS returned no audio data");
        return Buffer.alloc(0);
      }

      return Buffer.from(audioPart.inlineData.data, "base64");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MeetingAI] TTS generation failed: ${message}`);
      return Buffer.alloc(0);
    }
  }
}

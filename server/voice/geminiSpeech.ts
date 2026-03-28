import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export interface SpeechSynthesizer {
  synthesize(text: string): Promise<Buffer>;
}

export class GeminiSpeechSynthesizer implements SpeechSynthesizer {
  private genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  async synthesize(text: string): Promise<Buffer> {
    const response = await this.genAI.models.generateContent({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Aoede",
            },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
    if (!audioPart?.inlineData?.data) {
      throw new Error("Gemini TTS returned no audio data");
    }

    return Buffer.from(audioPart.inlineData.data, "base64");
  }
}

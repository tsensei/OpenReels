import { GoogleGenAI } from "@google/genai";
import wavefile from "wavefile";
import type { TTSProvider, TTSResult } from "../../schema/providers.js";

/**
 * Google Gemini TTS provider.
 *
 * Uses the Gemini 2.5 Flash TTS model via @google/genai. Returns raw 24kHz
 * mono PCM encoded as WAV. Word-level timestamps are NOT available from this
 * API — the AlignedTTSProvider decorator handles alignment via Whisper.
 *
 * Reuses the existing GOOGLE_API_KEY. No additional API key needed.
 */
export class GeminiTTS implements TTSProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor(model: string = "gemini-2.5-flash-preview-tts", apiKey?: string) {
    const key = apiKey ?? process.env["GOOGLE_API_KEY"];
    if (!key)
      throw new Error(
        "GOOGLE_API_KEY environment variable is required for Gemini TTS",
      );
    this.client = new GoogleGenAI({ apiKey: key });
    this.model = model;
  }

  async generate(text: string): Promise<TTSResult> {
    let response;
    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        throw new Error(`Gemini TTS rate limited: ${msg}`);
      }
      if (
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("API_KEY_INVALID")
      ) {
        throw new Error(
          `Gemini TTS authentication failed: ${msg}. Check your GOOGLE_API_KEY.`,
        );
      }
      throw new Error(`Gemini TTS API error: ${msg}`);
    }

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find(
      (p: { inlineData?: { mimeType?: string } }) =>
        p.inlineData?.mimeType?.startsWith("audio/"),
    );

    if (!audioPart?.inlineData?.data) {
      throw new Error(
        "Gemini TTS returned no audio data. The response may be empty or the model may have refused the input.",
      );
    }

    // Gemini TTS returns base64-encoded raw 24kHz 16-bit mono PCM
    const rawAudio = Buffer.from(audioPart.inlineData.data, "base64");

    // Encode as proper WAV if not already
    let wavBuffer: Buffer;
    if (rawAudio.length >= 4 && rawAudio.toString("ascii", 0, 4) === "RIFF") {
      wavBuffer = rawAudio;
    } else {
      // Raw PCM bytes → Int16Array (wavefile.fromScratch treats Buffer elements as
      // individual samples, doubling the data size and garbling the audio)
      const samples = new Int16Array(
        rawAudio.buffer,
        rawAudio.byteOffset,
        rawAudio.byteLength / 2,
      );
      const wav = new wavefile.WaveFile();
      wav.fromScratch(1, 24000, "16", samples);
      wavBuffer = Buffer.from(wav.toBuffer());
    }

    return { audio: wavBuffer, words: [] };
  }
}

import OpenAI from "openai";
import type { TTSProvider, TTSResult } from "../../schema/providers.js";

/**
 * OpenAI TTS provider.
 *
 * Uses gpt-4o-mini-tts via the OpenAI SDK. Returns WAV audio so the
 * AlignedTTSProvider decorator can run Whisper alignment (which requires
 * WAV/PCM input), then transcode to MP3.
 *
 * Reuses the existing OPENAI_API_KEY. No additional API key needed.
 */
export class OpenAITTS implements TTSProvider {
  private client: OpenAI;
  private model: string;
  private voice: string;

  constructor(model: string = "gpt-4o-mini-tts", apiKey?: string) {
    const key = apiKey ?? process.env["OPENAI_API_KEY"];
    if (!key)
      throw new Error(
        "OPENAI_API_KEY environment variable is required for OpenAI TTS",
      );
    this.client = new OpenAI({ apiKey: key });
    this.model = model;
    this.voice = "alloy";
  }

  async generate(text: string): Promise<TTSResult> {
    let response;
    try {
      response = await this.client.audio.speech.create({
        model: this.model,
        voice: this.voice as "alloy",
        input: text,
        response_format: "wav",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("rate_limit")) {
        throw new Error(`OpenAI TTS rate limited: ${msg}`);
      }
      if (
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("invalid_api_key")
      ) {
        throw new Error(
          `OpenAI TTS authentication failed: ${msg}. Check your OPENAI_API_KEY.`,
        );
      }
      throw new Error(`OpenAI TTS API error: ${msg}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error(
        "OpenAI TTS returned no audio data. The response may be empty or the model may have refused the input.",
      );
    }

    return { audio: Buffer.from(arrayBuffer), words: [] };
  }
}

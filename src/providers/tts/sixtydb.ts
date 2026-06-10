import type { TTSProvider, TTSResult } from "../../schema/providers.js";

// 60db sync REST TTS — POST /tts-synthesize returns base64-encoded audio
// in a single JSON body. Pairs with AlignedTTSProvider for word timestamps
// (same pattern as kokoro/gemini-tts/openai-tts — none of those return
// alignment natively either).
// Reference: https://docs.60db.ai/api-reference/tts/text-to-speech
const SIXTYDB_BASE = process.env["SIXTYDB_API_BASE"] ?? "https://api.60db.ai";

export class SixtyDbTTS implements TTSProvider {
  private apiKey: string;
  private voiceId: string;

  constructor(
    voiceId: string = "fbb75ed2-975a-40c7-9e06-38e30524a9a1",
    apiKey?: string,
  ) {
    const key = apiKey ?? process.env["SIXTYDB_API_KEY"];
    if (!key) throw new Error("SIXTYDB_API_KEY environment variable is required");
    this.apiKey = key;
    this.voiceId = voiceId;
  }

  async generate(text: string): Promise<TTSResult> {
    const response = await fetch(`${SIXTYDB_BASE}/tts-synthesize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: this.voiceId,
        enhance: true,
        speed: 1,
        stability: 50,
        similarity: 75,
        // mp3 matches the pipeline's voiceover.mp3 contract — no transcoding.
        output_format: "mp3",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`60db /tts-synthesize ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      success: boolean;
      audio_base64: string;
      sample_rate: number;
      duration_seconds: number;
      output_format: string;
      message?: string;
    };
    if (!data.success || !data.audio_base64) {
      throw new Error(`60db /tts-synthesize returned no audio: ${data.message ?? "unknown"}`);
    }

    // No native word timestamps — AlignedTTSProvider injects them via Whisper.
    return {
      audio: Buffer.from(data.audio_base64, "base64"),
      words: [],
    };
  }
}

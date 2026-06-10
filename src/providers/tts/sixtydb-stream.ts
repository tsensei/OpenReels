import type { TTSProvider, TTSResult } from "../../schema/providers.js";

// 60db NDJSON streaming TTS — POST /tts-stream. Emits newline-delimited
// JSON: {type:"chunk", audioContent:<base64>} lines terminated by
// {type:"complete"}.
//
// OpenReels' pipeline consumes a whole MP3 buffer at the end of the
// voiceover stage, so this class concatenates all chunks before returning.
// Exposed as a separate TTSProviderKey ("60db-stream") for users who want
// progressive synthesis at the network layer even if the pipeline doesn't
// consume it progressively.
// Reference: https://docs.60db.ai/api-reference/tts/text-to-speech-stream
const SIXTYDB_BASE = process.env["SIXTYDB_API_BASE"] ?? "https://api.60db.ai";

export class SixtyDbStreamTTS implements TTSProvider {
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
    const response = await fetch(`${SIXTYDB_BASE}/tts-stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: this.voiceId,
        output_format: "mp3",
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      throw new Error(`60db /tts-stream ${response.status}: ${errText.slice(0, 300)}`);
    }

    // Parse NDJSON: split on \n, JSON.parse each line, accumulate chunks.
    const chunks: Buffer[] = [];
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let leftover = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      leftover += decoder.decode(value, { stream: true });
      const lines = leftover.split("\n");
      leftover = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let msg: { type?: string; audioContent?: string };
        try {
          msg = JSON.parse(trimmed) as typeof msg;
        } catch {
          continue;
        }
        if (msg.type === "error") {
          throw new Error(`60db /tts-stream emitted error: ${trimmed.slice(0, 200)}`);
        }
        if (msg.type === "complete") {
          break;
        }
        if (msg.audioContent) {
          chunks.push(Buffer.from(msg.audioContent, "base64"));
        }
      }
    }

    return {
      audio: Buffer.concat(chunks),
      words: [],
    };
  }
}

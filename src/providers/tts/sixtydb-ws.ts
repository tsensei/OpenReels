import wavefile from "wavefile";
import WebSocket from "ws";
import type { TTSProvider, TTSResult } from "../../schema/providers.js";

// 60db realtime WebSocket TTS — wss://api.60db.ai/ws/tts.
// Audio comes back as LINEAR16 PCM (no MP3 over WS), so we collect the
// PCM chunks for the whole utterance and wrap them in a WAV container.
// AlignedTTSProvider's existing isWav() detection then transcodes WAV → MP3
// via ffmpeg, keeping the voiceover.mp3 contract intact.
// Reference: https://docs.60db.ai/websocket-api/tts
const SIXTYDB_BASE = process.env["SIXTYDB_API_BASE"] ?? "https://api.60db.ai";
const TTS_SAMPLE_RATE = 24000;

export class SixtyDbWsTTS implements TTSProvider {
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
    const wsUrl =
      SIXTYDB_BASE.replace(/^https?:/, "wss:") +
      `/ws/tts?apiKey=${encodeURIComponent(this.apiKey)}`;
    const contextId = `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const pcmChunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      const cleanup = (err?: Error) => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
        if (err) reject(err);
        else resolve();
      };

      ws.on("error", (err) => cleanup(err instanceof Error ? err : new Error(String(err))));

      ws.on("message", (data) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(data.toString()) as Record<string, unknown>;
        } catch {
          return;
        }
        if ("connection_established" in msg) {
          ws.send(
            JSON.stringify({
              create_context: {
                context_id: contextId,
                voice_id: this.voiceId,
                audio_config: {
                  audio_encoding: "LINEAR16",
                  sample_rate_hertz: TTS_SAMPLE_RATE,
                },
              },
            }),
          );
          return;
        }
        if ("context_created" in msg) {
          ws.send(JSON.stringify({ send_text: { context_id: contextId, text } }));
          ws.send(JSON.stringify({ flush_context: { context_id: contextId } }));
          return;
        }
        const chunk = (msg.audio_chunk as { audioContent?: string } | undefined)?.audioContent;
        if (chunk) {
          pcmChunks.push(Buffer.from(chunk, "base64"));
          return;
        }
        if ("flush_completed" in msg) {
          try {
            ws.send(JSON.stringify({ close_context: { context_id: contextId } }));
          } catch {
            /* noop */
          }
          cleanup();
        }
      });
    });

    if (pcmChunks.length === 0) {
      throw new Error("60db /ws/tts returned no audio");
    }

    // Wrap raw 16-bit PCM into a WAV file so AlignedTTSProvider's
    // ffmpeg path can transcode it to MP3 just like Kokoro's WAV output.
    const wav = new wavefile.WaveFile();
    const pcm = Buffer.concat(pcmChunks);
    // wavefile expects an Int16Array for 16-bit samples.
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2);
    wav.fromScratch(1, TTS_SAMPLE_RATE, "16", Array.from(samples));

    return {
      audio: Buffer.from(wav.toBuffer()),
      words: [],
    };
  }
}

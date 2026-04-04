import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TTSProvider, TTSResult } from "../../schema/providers.js";

const WORKER_PATH = fileURLToPath(new URL("./kokoro-worker.ts", import.meta.url));

/**
 * Local TTS provider using Kokoro 82M (via kokoro-js).
 *
 * Runs in a subprocess to avoid the ONNX runtime conflict between kokoro-js
 * and @huggingface/transformers. The subprocess generates audio and writes a
 * WAV file; this provider reads it back and returns { audio, words: [] }.
 * The AlignedTTSProvider decorator handles timestamp extraction via Whisper.
 *
 * Zero API cost. Model auto-downloads from HuggingFace on first run (~86MB).
 */
export class KokoroTTS implements TTSProvider {
  private voice: string;

  constructor(voice: string = "af_heart") {
    this.voice = voice;
  }

  async generate(text: string): Promise<TTSResult> {
    const tmp = await mkdtemp(join(tmpdir(), "kokoro-"));

    try {
      const configPath = join(tmp, "config.json");
      const outputPath = join(tmp, "output.wav");

      await writeFile(
        configPath,
        JSON.stringify({ text, voice: this.voice, outputPath }),
      );

      await new Promise<void>((resolve, reject) => {
        execFile(
          "npx",
          ["tsx", WORKER_PATH, configPath],
          { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 },
          (err, _stdout, stderr) => {
            if (err) {
              const msg = stderr?.trim() || err.message;
              reject(
                new Error(
                  `Kokoro TTS failed: ${msg}. ` +
                    "Ensure kokoro-js is installed (pnpm install). " +
                    "The Kokoro model (~86MB) downloads from HuggingFace on first run.",
                ),
              );
            } else {
              resolve();
            }
          },
        );
      });

      const audio = await readFile(outputPath);
      return { audio: Buffer.from(audio), words: [] };
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  }
}

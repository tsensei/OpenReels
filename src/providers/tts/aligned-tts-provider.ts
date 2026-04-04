import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TTSProvider, TTSResult } from "../../schema/providers.js";
import type { WhisperAligner } from "./whisper-aligner.js";

/**
 * Decorator that wraps any TTSProvider and auto-injects word-level timestamps
 * when the inner provider returns an empty words array. Also transcodes WAV
 * audio to MP3 to maintain the pipeline's MP3 contract.
 *
 *   inner.generate(text)
 *     │
 *     ├── words.length > 0 ──► passthrough (ElevenLabs, Inworld)
 *     │
 *     └── words.length === 0 ──► whisperAligner.align()
 *                                    │
 *                                    ├── aligned words > 0 ──► return
 *                                    └── aligned words === 0 ──► HARD FAIL
 *
 *   If audio is WAV (RIFF header) ──► ffmpeg transcode to MP3
 */
export class AlignedTTSProvider implements TTSProvider {
  constructor(
    private inner: TTSProvider,
    private aligner: WhisperAligner,
  ) {}

  async generate(text: string): Promise<TTSResult> {
    const result = await this.inner.generate(text);

    let { audio, words } = result;

    // Auto-align if provider returned no timestamps
    if (words.length === 0 && text.trim().length > 0) {
      words = await this.aligner.align(audio, text);
    }

    // Transcode WAV to MP3 to match pipeline's voiceover.mp3 contract
    if (isWav(audio)) {
      audio = await transcodeWavToMp3(audio);
    }

    return { audio, words };
  }
}

/** Check if buffer starts with RIFF/WAV header */
function isWav(buf: Buffer): boolean {
  return buf.length >= 4 && buf.toString("ascii", 0, 4) === "RIFF";
}

/** Transcode WAV buffer to MP3 via ffmpeg (temp files). */
async function transcodeWavToMp3(wav: Buffer): Promise<Buffer> {
  const tmp = await mkdtemp(join(tmpdir(), "tts-transcode-"));
  const wavPath = join(tmp, "input.wav");
  const mp3Path = join(tmp, "output.mp3");

  try {
    await writeFile(wavPath, wav);

    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        ["-y", "-i", wavPath, "-codec:a", "libmp3lame", "-q:a", "2", mp3Path],
        { timeout: 30_000 },
        (err) => {
          if (err) {
            reject(
              new Error(
                `WAV→MP3 transcode failed: ${err.message}. Ensure ffmpeg is installed and in PATH.`,
              ),
            );
          } else {
            resolve();
          }
        },
      );
    });

    return await readFile(mp3Path);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

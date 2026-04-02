import { execFileSync, spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { TTSProvider, TTSResult, WordTimestamp } from "../../schema/providers.js";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "chatterbox_tts.py");

export class ChatterboxTTS implements TTSProvider {
  private pythonBin: string;
  private device: string;
  private audioPrompt: string | null;

  /**
   * @param opts.pythonBin  Venv Python path returned by validateEnv. When omitted
   *                        (e.g. tests), falls back to searching PATH for python3.12/3.11.
   */
  constructor(opts: { device?: string; audioPrompt?: string; pythonBin?: string } = {}) {
    this.device = opts.device ?? this.detectDevice();
    this.audioPrompt = opts.audioPrompt ?? null;
    this.pythonBin = opts.pythonBin ?? this.resolvePythonBin();
  }

  async generate(text: string): Promise<TTSResult> {
    const tmpDir = os.tmpdir();
    const id = `openreels-tts-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const wavPath = path.join(tmpDir, `${id}.wav`);
    const mp3Path = path.join(tmpDir, `${id}.mp3`);
    const tsPath = path.join(tmpDir, `${id}.json`);

    try {
      const args = [
        SCRIPT_PATH,
        "--text", text,
        "--out", wavPath,
        "--timestamps", tsPath,
        "--device", this.device,
      ];
      if (this.audioPrompt) {
        args.push("--audio-prompt", this.audioPrompt);
      }

      console.info(
        `\nChatterbox Turbo: generating audio` +
        (this.device !== "cpu" ? ` (device: ${this.device})` : ` (device: cpu — may be slow)`) +
        `...\n`,
      );

      // Use async spawn so stderr streams live to the terminal (shows model load progress)
      // and the Node.js event loop is not blocked during the potentially long model load.
      await spawnAsync(this.pythonBin, args);

      if (!fs.existsSync(wavPath)) {
        throw new Error(`Chatterbox TTS did not produce output file: ${wavPath}`);
      }

      // Convert WAV → MP3 using ffmpeg (already required by the pipeline)
      execFileSync("ffmpeg", [
        "-y", "-i", wavPath,
        "-codec:a", "libmp3lame", "-q:a", "2",
        mp3Path,
      ], { stdio: "pipe" });

      const audio = fs.readFileSync(mp3Path);

      const rawTimestamps = JSON.parse(fs.readFileSync(tsPath, "utf-8")) as unknown[];
      const words: WordTimestamp[] = rawTimestamps
        .filter((t): t is { word: string; start: number; end: number } =>
          typeof (t as Record<string, unknown>)["word"] === "string")
        .map((t) => ({ word: t.word, start: t.start, end: t.end }));

      return { audio, words };
    } finally {
      for (const f of [wavPath, mp3Path, tsPath]) {
        try { fs.unlinkSync(f); } catch { /* ignore cleanup errors */ }
      }
    }
  }

  private resolvePythonBin(): string {
    // Mirror the preference order in validate-env: prefer 3.12/3.11 over generic python3
    for (const bin of ["python3.12", "python3.11", "python3", "python"]) {
      const probe = spawnSync(bin, ["--version"], { encoding: "utf-8" });
      if (probe.status === 0) return bin;
    }
    throw new Error(
      `Python not found. Chatterbox Turbo requires Python 3.11 or 3.12.\n` +
      `  → macOS: brew install python@3.12\n` +
      `  → Then:  pip install chatterbox-tts`,
    );
  }

  private detectDevice(): string {
    // Prefer MPS on Apple Silicon, fall back to CPU
    const platform = process.platform;
    if (platform === "darwin") {
      const arch = process.arch;
      if (arch === "arm64") return "mps";
    }
    return "cpu";
  }
}

/**
 * Async wrapper around child_process.spawn.
 * Streams stderr live to the terminal so users can see Chatterbox model loading progress.
 * Rejects with a descriptive error if the process exits non-zero.
 */
function spawnAsync(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "inherit"], // stdout captured (not used), stderr → terminal live
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start Chatterbox TTS process: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Chatterbox TTS script exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

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

      process.stderr.write(
        `\n  Chatterbox Turbo: synthesising audio` +
        (this.device !== "cpu" ? ` on ${this.device}` : ` on cpu (may be slow)`) +
        `...\n`,
      );

      // Async spawn — stderr is captured and filtered so raw tqdm progress bars
      // don't pollute the terminal alongside the Node.js pipeline progress spinner.
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
 *
 * Captures Python's stderr and filters it so that:
 *   - Raw tqdm progress bars (the noisy `0%|█ | 0/1000` lines) are suppressed
 *   - Key status messages (model loading, "Audio saved") are forwarded as clean lines
 *   - Any unexpected errors are still surfaced on stderr for debugging
 *
 * Rejects with a descriptive error if the process exits non-zero.
 */
function spawnAsync(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"], // capture both stdout and stderr
    });

    // Accumulate stderr to surface on failure, and filter noisy lines in real-time
    const stderrLines: string[] = [];
    let stderrBuf = "";

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? ""; // keep incomplete last line in buffer

      for (const line of lines) {
        stderrLines.push(line);
        const cleaned = line.trim();
        if (!cleaned) continue;

        // Suppress tqdm progress bars: they contain "|" and "it/s" or "%|"
        if (/\d+%\|/.test(cleaned) || /it\/s\]/.test(cleaned)) continue;
        // Suppress diffusers FutureWarning noise
        if (/FutureWarning|LoRACompatible|deprecate/.test(cleaned)) continue;
        // Suppress blank carriage-return lines tqdm emits
        if (/^\r/.test(cleaned)) continue;

        // Forward meaningful status messages cleanly
        if (/Loading|loaded|Fetching|S3 Token|Audio saved|Timestamps/.test(cleaned)) {
          process.stderr.write(`  ${cleaned}\n`);
        }
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start Chatterbox TTS process: ${err.message}`));
    });

    child.on("close", (code) => {
      // Flush any remaining buffered stderr
      if (stderrBuf.trim()) stderrLines.push(stderrBuf);

      if (code === 0) {
        process.stderr.write(`  Chatterbox Turbo: audio ready.\n\n`);
        resolve();
      } else {
        // On failure, print the last few lines of stderr to aid debugging
        const tail = stderrLines.slice(-10).join("\n");
        reject(new Error(
          `Chatterbox TTS script exited with code ${code ?? "unknown"}.\n${tail}`,
        ));
      }
    });
  });
}

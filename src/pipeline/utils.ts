import { execFileSync } from "node:child_process";
import * as readline from "node:readline";
import type { ActualCostBreakdown, CostBreakdown } from "../cli/cost-estimator.js";
import type { DirectorScore } from "../schema/director-score.js";
import type { LanguageModel } from "ai";
import type {
  ImageProvider,
  ImageProviderKey,
  LLMProvider,
  MusicProvider,
  MusicProviderKey,
  StockProvider,
  TTSProvider,
  TTSProviderKey,
  VideoProvider,
  VideoProviderKey,
  WordTimestamp,
} from "../schema/providers.js";

// Stage names matching the pipeline execution order
export const STAGE_NAMES = [
  "research",
  "director",
  "tts",
  "visuals",
  "assembly",
  "critic",
] as const;
export type StageName = (typeof STAGE_NAMES)[number];

export interface PipelineCallbacks {
  onStageStart?(stage: StageName): void;
  onStageComplete?(stage: StageName, detail: string, durationSec: number): void;
  onStageSkip?(stage: StageName, reason: string): void;
  onStageError?(stage: StageName, error: string): void;
  onProgress?(stage: StageName, data: Record<string, unknown>): void;
  onCostEstimate?(estimate: CostBreakdown, imageProvider: ImageProviderKey, stockSceneCount?: number): Promise<boolean>;
  onActualCost?(cost: ActualCostBreakdown): void;
  onLog?(message: string): void;
  /** Called once the run directory is created, before any stage runs. */
  onRunDir?(runDir: string): void;
  /** Called when pipeline is cancelled between stages. Return true if cancelled. */
  isCancelled?(): boolean;
}

export interface PipelineOptions {
  topic: string;
  llm: LLMProvider;
  tts: TTSProvider;
  ttsProvider: TTSProviderKey;
  imageGen: ImageProvider;
  imageProvider: ImageProviderKey;
  stock: StockProvider[];
  archetype?: string;
  pacing?: string;
  platform: string;
  dryRun: boolean;
  preview: boolean;
  outputDir: string;
  yes: boolean;
  noMusic?: boolean;
  musicProvider?: MusicProvider;
  musicProviderKey?: MusicProviderKey;
  stockVerify?: boolean;
  stockConfidence?: number;
  stockMaxAttempts?: number;
  verifyModel?: LanguageModel;
  videoProviders?: VideoProvider[];
  videoProvider?: VideoProviderKey;
  noVideo?: boolean;
  direction?: string;
  replayScore?: DirectorScore;
}

export interface PipelineResult {
  outputDir: string;
  videoPath: string | null;
  thumbnailPath: string | null;
  scorePath: string;
  logPath: string;
}

export function shouldAutoConfirm(yes: boolean): boolean {
  return yes || !process.stdin.isTTY;
}

export function shouldSkipPreview(): boolean {
  return !process.stdin.isTTY;
}

export function splitWordsIntoScenes(score: DirectorScore, allWords: WordTimestamp[]): WordTimestamp[][] {
  // Split word timestamps into per-scene groups for duration calculation.
  // Uses ReelMistri's proportional scaling approach to handle ElevenLabs
  // text normalization (numbers/abbreviations expand into different word counts).
  //
  // Note: This is only used for scene DURATION calculation. Captions use
  // allWords directly with absolute timestamps (timeline-centric approach).

  if (allWords.length === 0) {
    return score.scenes.map(() => []);
  }

  // Count expected words per scene from script text
  const wordsPerScene = score.scenes.map((s) => s.script_line.split(/\s+/).filter(Boolean).length);
  const totalExpected = wordsPerScene.reduce((sum, n) => sum + n, 0);
  const totalActual = allWords.length;

  const sceneWords: WordTimestamp[][] = [];
  let wordIndex = 0;

  for (let i = 0; i < score.scenes.length; i++) {
    const expectedCount = wordsPerScene[i] ?? 0;

    // Proportionally scale word consumption if TTS word count differs
    // (ReelMistri: tts.py lines 179-182)
    let wordsToConsume = expectedCount;
    if (totalExpected !== totalActual && totalExpected > 0) {
      wordsToConsume = Math.round((expectedCount * totalActual) / totalExpected);
      wordsToConsume = Math.max(1, wordsToConsume);
    }

    const words: WordTimestamp[] = [];
    for (let j = 0; j < wordsToConsume && wordIndex < allWords.length; j++) {
      const w = allWords[wordIndex];
      if (w) words.push(w);
      wordIndex++;
    }

    sceneWords.push(words);
  }

  // Any remaining words go to the last scene
  const lastScene = sceneWords[sceneWords.length - 1];
  if (lastScene) {
    while (wordIndex < allWords.length) {
      const w = allWords[wordIndex];
      if (w) lastScene.push(w);
      wordIndex++;
    }
  }

  return sceneWords;
}

export function getVideoDuration(filePath: string): number | null {
  try {
    const result = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
      { encoding: "utf-8" },
    );
    const duration = parseFloat(result.trim());
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
}

export function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [Y/n] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() !== "n");
    });
  });
}

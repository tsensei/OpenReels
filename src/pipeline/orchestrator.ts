import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { generateDirectorScore } from "../agents/creative-director.js";
import { evaluate } from "../agents/critic.js";
import { optimizeImagePrompt } from "../agents/image-prompter.js";
import { research } from "../agents/research.js";
import type { ActualCostBreakdown, CostBreakdown } from "../cli/cost-estimator.js";
import {
  computeActualLLMCost,
  estimateCost,
  formatActualCost,
  formatCostEstimate,
} from "../cli/cost-estimator.js";
import { ProgressDisplay } from "../cli/progress.js";
import { getArchetype } from "../config/archetype-registry.js";
import { getPlatformConfig } from "../config/platforms.js";
import { selectTrack } from "../providers/music/bundled.js";
import { getTotalDurationInFrames, mapScoreToProps } from "../remotion/lib/score-to-props.js";
import type { ArchetypeConfig } from "../schema/archetype.js";
import type { DirectorScore } from "../schema/director-score.js";
import type {
  ImageProvider,
  ImageProviderKey,
  LLMProvider,
  LLMUsage,
  StockProvider,
  TTSProvider,
  TTSProviderKey,
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
  onCostEstimate?(estimate: CostBreakdown, imageProvider: ImageProviderKey): Promise<boolean>;
  onActualCost?(cost: ActualCostBreakdown): void;
  onLog?(message: string): void;
  /** Called when pipeline is cancelled between stages. Return true if cancelled. */
  isCancelled?(): boolean;
}

export function shouldAutoConfirm(yes: boolean): boolean {
  return yes || !process.stdin.isTTY;
}

export function shouldSkipPreview(): boolean {
  return !process.stdin.isTTY;
}

/** Create CLI callbacks that wrap ProgressDisplay for terminal output */
export function createCliCallbacks(yes: boolean): {
  callbacks: PipelineCallbacks;
  progress: ProgressDisplay;
} {
  const progress = new ProgressDisplay();
  const stageIndices = new Map<StageName, number>();
  for (const name of STAGE_NAMES) {
    stageIndices.set(name, progress.addStage(name.charAt(0).toUpperCase() + name.slice(1)));
  }

  const idx = (stage: StageName) => stageIndices.get(stage) ?? 0;

  const callbacks: PipelineCallbacks = {
    onStageStart(stage) {
      progress.start(idx(stage));
    },
    onStageComplete(stage, detail) {
      progress.complete(idx(stage), detail);
    },
    onStageSkip(stage, reason) {
      progress.skip(idx(stage), reason);
    },
    onStageError(stage, error) {
      progress.fail(idx(stage), error);
    },
    async onCostEstimate(estimate, imageProvider) {
      console.log(`\n${formatCostEstimate(estimate, imageProvider)}`);
      const autoConfirm = shouldAutoConfirm(yes);
      if (autoConfirm) return true;
      return confirm("Proceed with generation?");
    },
    onActualCost(cost) {
      console.log(`\n${formatActualCost(cost)}`);
    },
    onLog(message) {
      console.log(message);
    },
  };

  return { callbacks, progress };
}

export interface PipelineOptions {
  topic: string;
  llm: LLMProvider;
  tts: TTSProvider;
  ttsProvider: TTSProviderKey;
  imageGen: ImageProvider;
  imageProvider: ImageProviderKey;
  stock: StockProvider;
  archetype?: string;
  platform: string;
  dryRun: boolean;
  preview: boolean;
  outputDir: string;
  yes: boolean;
  noMusic?: boolean;
}

export interface PipelineResult {
  outputDir: string;
  videoPath: string | null;
  thumbnailPath: string | null;
  scorePath: string;
  logPath: string;
}

interface RunLog {
  topic: string;
  startedAt: string;
  stages: { name: string; duration: number; status: string; error?: string }[];
  totalCost?: { estimated: number; actual?: number };
}

export async function runPipeline(
  opts: PipelineOptions,
  callbacks?: PipelineCallbacks,
): Promise<PipelineResult> {
  const cb = callbacks ?? {};
  const log: RunLog = {
    topic: opts.topic,
    startedAt: new Date().toISOString(),
    stages: [],
  };

  // Create output directory with timestamp to avoid overwrites
  const slug = opts.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const runDir = path.join(opts.outputDir, `${dateStr}-${timeStr}-${slug}`);
  fs.mkdirSync(runDir, { recursive: true });
  const assetsDir = path.join(runDir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const logPath = path.join(runDir, "log.json");
  const scorePath = path.join(runDir, "score.json");
  let videoPath: string | null = null;

  // Track all LLM token usage for actual cost reporting
  const llmUsages: LLMUsage[] = [];

  try {
    // Stage 1: Research
    cb.onStageStart?.("research");
    let researchResult;
    const researchStart = Date.now();
    try {
      const researchOutput = await research(opts.llm, opts.topic);
      researchResult = researchOutput.data;
      llmUsages.push(researchOutput.usage);
      const dur = (Date.now() - researchStart) / 1000;
      cb.onStageComplete?.("research", `${researchResult.key_facts.length} facts`, dur);
      cb.onProgress?.("research", { type: "results", summary: researchResult.summary, key_facts: researchResult.key_facts, mood: researchResult.mood });
      log.stages.push({ name: "research", duration: dur, status: "done" });
    } catch (err) {
      const dur = (Date.now() - researchStart) / 1000;
      cb.onStageSkip?.("research", "web search failed");
      log.stages.push({ name: "research", duration: dur, status: "skipped", error: String(err) });
      researchResult = {
        summary: `Topic: ${opts.topic}`,
        key_facts: [],
        mood: "informative",
        sources: [],
      };
    }

    // Check cancellation between stages
    if (cb.isCancelled?.()) {
      return { outputDir: runDir, videoPath: null, thumbnailPath: null, scorePath, logPath };
    }

    // Stage 2: Creative Director
    cb.onStageStart?.("director");
    const cdStart = Date.now();
    const cdOutput = await generateDirectorScore(opts.llm, opts.topic, researchResult, {
      archetype: opts.archetype,
    });
    const directorScore = cdOutput.data;
    llmUsages.push(cdOutput.usage);
    const cdDur = (Date.now() - cdStart) / 1000;
    cb.onStageComplete?.(
      "director",
      `${directorScore.scenes.length} scenes, ${directorScore.archetype}`,
      cdDur,
    );
    log.stages.push({ name: "creative-director", duration: cdDur, status: "done" });

    // Resolve archetype config for image prompt optimization
    const archetypeConfig = getArchetype(directorScore.archetype);

    // Save DirectorScore
    fs.writeFileSync(scorePath, JSON.stringify(directorScore, null, 2));
    cb.onProgress?.("director", { type: "score", score: directorScore });

    // Dry run exit
    if (opts.dryRun) {
      cb.onStageSkip?.("tts", "dry run");
      cb.onStageSkip?.("visuals", "dry run");
      cb.onStageSkip?.("assembly", "dry run");
      cb.onStageSkip?.("critic", "dry run");

      cb.onLog?.("\n--- DirectorScore ---");
      cb.onLog?.(JSON.stringify(directorScore, null, 2));

      return { outputDir: runDir, videoPath: null, thumbnailPath: null, scorePath, logPath };
    }

    // Cost estimation
    const costBreakdown = estimateCost(directorScore, opts.imageProvider, opts.ttsProvider);
    log.totalCost = { estimated: costBreakdown.totalCost };

    if (cb.onCostEstimate) {
      const proceed = await cb.onCostEstimate(costBreakdown, opts.imageProvider);
      if (!proceed) {
        return { outputDir: runDir, videoPath: null, thumbnailPath: null, scorePath, logPath };
      }
    }

    if (cb.isCancelled?.()) {
      return { outputDir: runDir, videoPath: null, thumbnailPath: null, scorePath, logPath };
    }

    // Stage 3: TTS
    cb.onStageStart?.("tts");
    const ttsStart = Date.now();
    const fullScript = directorScore.scenes.map((s) => s.script_line).join(" ");
    const ttsResult = await opts.tts.generate(fullScript);
    const ttsDur = (Date.now() - ttsStart) / 1000;

    // Save audio
    const voiceoverPath = path.join(assetsDir, "voiceover.mp3");
    fs.writeFileSync(voiceoverPath, ttsResult.audio);

    // Split word timestamps into per-scene groups
    const sceneWords = splitWordsIntoScenes(directorScore, ttsResult.words);
    cb.onStageComplete?.("tts", `${ttsResult.words.length} words`, ttsDur);
    log.stages.push({ name: "tts", duration: ttsDur, status: "done" });

    if (cb.isCancelled?.()) {
      return { outputDir: runDir, videoPath: null, thumbnailPath: null, scorePath, logPath };
    }

    // Stage 4: Visual Assets (parallel)
    cb.onStageStart?.("visuals");
    const visualStart = Date.now();
    const totalScenes = directorScore.scenes.length;
    const sceneResults = await Promise.all(
      directorScore.scenes.map(async (scene, i) => {
        try {
          return await resolveVisualAsset(scene, i, totalScenes, assetsDir, opts, archetypeConfig);
        } catch (err) {
          cb.onProgress?.("visuals", { type: "asset_failed", scene: i, error: String(err) });
          return {
            path: null as string | null,
            usage: null as LLMUsage | null,
            durationSeconds: null,
          };
        }
      }),
    );
    const sceneAssets = sceneResults.map((r) => r.path);
    const sceneSourceDurations = sceneResults.map((r) => r.durationSeconds);
    for (const r of sceneResults) {
      if (r.usage) llmUsages.push(r.usage);
    }
    const visualDur = (Date.now() - visualStart) / 1000;
    const assetCount = sceneAssets.filter(Boolean).length;
    cb.onStageComplete?.(
      "visuals",
      `${assetCount}/${directorScore.scenes.length} assets`,
      visualDur,
    );
    log.stages.push({ name: "visuals", duration: visualDur, status: "done" });

    if (cb.isCancelled?.()) {
      return { outputDir: runDir, videoPath: null, thumbnailPath: null, scorePath, logPath };
    }

    // Music selection (between visuals and assembly)
    let musicFilePath: string | null = null;
    let musicSelection: { trackId: string; mood: string; requestedMood: string; fallback: boolean } | null = null;
    if (!opts.noMusic) {
      try {
        const selection = selectTrack(directorScore.music_mood);
        if (selection) {
          musicFilePath = selection.filePath;
          musicSelection = selection;
        }
      } catch (err) {
        console.warn(`[orchestrator] Music selection failed, proceeding without music: ${err}`);
      }
    }

    // Stage 5: Remotion Assembly
    cb.onStageStart?.("assembly");
    if (musicSelection) {
      cb.onProgress?.("assembly", {
        type: "music",
        track: musicSelection.trackId,
        mood: musicSelection.mood,
        requestedMood: musicSelection.requestedMood,
        fallback: musicSelection.fallback,
      });
    }
    const assemblyStart = Date.now();
    const platformConfig = getPlatformConfig(opts.platform);

    // Symlink assets into a temp public dir for Remotion to serve via staticFile()
    const publicDir = path.join(runDir, "_remotion_public");
    fs.mkdirSync(publicDir, { recursive: true });
    const assetsLink = path.join(publicDir, "assets");
    if (fs.existsSync(assetsLink)) fs.rmSync(assetsLink, { recursive: true });
    fs.symlinkSync(path.resolve(assetsDir), assetsLink);

    // Voiceover also needs to be accessible
    fs.copyFileSync(voiceoverPath, path.join(publicDir, "voiceover.mp3"));

    // Copy music track to publicDir if selected
    if (musicFilePath) {
      try {
        fs.copyFileSync(musicFilePath, path.join(publicDir, "music.mp3"));
      } catch (err) {
        console.warn(`[orchestrator] Failed to copy music file, proceeding without music: ${err}`);
        musicFilePath = null;
      }
    }

    const compositionProps = mapScoreToProps(
      directorScore,
      {
        sceneAssets: sceneAssets.map((a) => {
          if (!a) return null;
          const filename = path.basename(a);
          return `assets/${filename}`;
        }),
        voiceoverPath: "voiceover.mp3",
        musicPath: musicFilePath ? "music.mp3" : null,
        sceneWords,
        allWords: ttsResult.words,
        sceneSourceDurations,
      },
      platformConfig.fps,
    );

    const totalFrames = getTotalDurationInFrames(compositionProps, platformConfig.fps);

    cb.onProgress?.("assembly", { type: "bundling" });

    const remotionEntry = path.join(process.cwd(), "src", "remotion", "index.ts");
    const bundled = await bundle({
      entryPoint: remotionEntry,
      webpackOverride: (config: object) => config,
      publicDir,
    });

    cb.onProgress?.("assembly", { type: "rendering", totalFrames });

    const composition = await selectComposition({
      serveUrl: bundled,
      id: "OpenReelsVideo",
      inputProps: compositionProps as unknown as Record<string, unknown>,
    });

    videoPath = path.join(runDir, "final.mp4");
    await renderMedia({
      composition: {
        ...composition,
        width: platformConfig.width,
        height: platformConfig.height,
        fps: platformConfig.fps,
        durationInFrames: totalFrames,
      },
      serveUrl: bundled,
      codec: "h264",
      outputLocation: videoPath,
      inputProps: compositionProps as unknown as Record<string, unknown>,
    });

    const assemblyDur = (Date.now() - assemblyStart) / 1000;
    cb.onStageComplete?.(
      "assembly",
      `${(totalFrames / platformConfig.fps).toFixed(1)}s video`,
      assemblyDur,
    );
    log.stages.push({ name: "assembly", duration: assemblyDur, status: "done" });

    if (cb.isCancelled?.()) {
      return { outputDir: runDir, videoPath, thumbnailPath: null, scorePath, logPath };
    }

    // Stage 6: Critic
    cb.onStageStart?.("critic");
    const criticStart = Date.now();
    try {
      const critiqueOutput = await evaluate(opts.llm, directorScore, opts.topic);
      const critique = critiqueOutput.data;
      llmUsages.push(critiqueOutput.usage);
      const criticDur = (Date.now() - criticStart) / 1000;

      if (critique.revision_needed && critique.score < 7) {
        cb.onStageComplete?.("critic", `score ${critique.score}/10, revision needed`, criticDur);
        cb.onLog?.(`\nCritic score: ${critique.score}/10 — ${critique.weaknesses.join(", ")}`);
        cb.onLog?.("Revision support coming in a future release. Using current version.");
      } else {
        cb.onStageComplete?.("critic", `score ${critique.score}/10`, criticDur);
      }
      cb.onProgress?.("critic", { type: "review", score: critique.score, strengths: critique.strengths, weaknesses: critique.weaknesses });
      log.stages.push({ name: "critic", duration: criticDur, status: "done" });
    } catch (err) {
      const criticDur = (Date.now() - criticStart) / 1000;
      cb.onStageSkip?.("critic", "evaluation failed");
      log.stages.push({
        name: "critic",
        duration: criticDur,
        status: "skipped",
        error: String(err),
      });
    }

    // Compute and report actual cost
    const aiImages = directorScore.scenes.filter((s) => s.visual_type === "ai_image").length;
    const ttsCharacters = directorScore.scenes.reduce((sum, s) => sum + s.script_line.length, 0);
    const actualCost = computeActualLLMCost(
      llmUsages,
      { aiImages, ttsCharacters },
      opts.llm.id,
      opts.imageProvider,
      opts.ttsProvider,
    );
    log.totalCost = { estimated: costBreakdown.totalCost, actual: actualCost.totalCost };
    cb.onActualCost?.(actualCost);

    // Preview (CLI only — uses terminal)
    if (opts.preview) {
      if (shouldSkipPreview()) {
        cb.onLog?.("\n--preview requires an interactive terminal (skipped in Docker/CI).");
      } else {
        cb.onLog?.("\nOpening Remotion Studio preview...");
        try {
          execFileSync("npx", ["remotion", "studio"], { stdio: "inherit" });
        } catch {
          cb.onLog?.("Preview closed or failed to open.");
        }
      }
    }

    cb.onLog?.(`\nOutput: ${runDir}`);
    cb.onLog?.(`  Video:     ${videoPath}`);
    cb.onLog?.(`  Score:     ${scorePath}`);
    cb.onLog?.(`  Log:       ${logPath}`);

    return { outputDir: runDir, videoPath, thumbnailPath: null, scorePath, logPath };
  } finally {
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  }
}

interface VisualAssetResult {
  path: string | null;
  usage: LLMUsage | null;
  durationSeconds: number | null;
}

async function resolveVisualAsset(
  scene: DirectorScore["scenes"][number],
  index: number,
  totalScenes: number,
  assetsDir: string,
  opts: PipelineOptions,
  archetype: ArchetypeConfig,
): Promise<VisualAssetResult> {
  switch (scene.visual_type) {
    case "ai_image": {
      // Optimize prompt via LLM before generating the image
      let prompt = scene.visual_prompt;
      let usage: LLMUsage | null = null;
      try {
        const optimized = await optimizeImagePrompt(
          opts.llm,
          scene.visual_prompt,
          scene.script_line,
          index,
          totalScenes,
          archetype,
        );
        prompt = optimized.prompt;
        usage = optimized.usage;
      } catch (err) {
        console.warn(`[visuals] Scene ${index} prompt optimization failed, using original: ${err}`);
      }
      const imageBuffer = await opts.imageGen.generate(prompt);
      const filePath = path.join(assetsDir, `scene-${index}-ai.png`);
      fs.writeFileSync(filePath, imageBuffer);
      return { path: filePath, usage, durationSeconds: null };
    }
    case "stock_image": {
      const asset = await opts.stock.searchImage(scene.visual_prompt);
      if (!asset) return { path: null, usage: null, durationSeconds: null };
      const dest = path.join(assetsDir, `scene-${index}-stock.jpg`);
      fs.copyFileSync(asset.filePath, dest);
      return { path: dest, usage: null, durationSeconds: null };
    }
    case "stock_video": {
      const asset = await opts.stock.searchVideo(scene.visual_prompt);
      if (!asset) return { path: null, usage: null, durationSeconds: null };
      const dest = path.join(assetsDir, `scene-${index}-stock.mp4`);
      fs.copyFileSync(asset.filePath, dest);
      const durationSeconds = getVideoDuration(dest);
      return { path: dest, usage: null, durationSeconds };
    }
    case "text_card": {
      return { path: null, usage: null, durationSeconds: null };
    }
    default:
      return { path: null, usage: null, durationSeconds: null };
  }
}

function splitWordsIntoScenes(score: DirectorScore, allWords: WordTimestamp[]): WordTimestamp[][] {
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

function getVideoDuration(filePath: string): number | null {
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

function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [Y/n] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() !== "n");
    });
  });
}

/**
 * OpenReels Pipeline as a Mastra Workflow
 *
 * Each pipeline stage is a createStep() node. The workflow is a linear graph:
 *   init → research → director → costEstimate → tts → visuals → music → assembly → critic
 *
 * State flows through getStepResult() / getInitData(). File I/O happens inside each step.
 * PipelineCallbacks are called within steps for progress reporting to web UI / CLI.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { generateDirectorScore } from "../agents/creative-director.js";
import { evaluate } from "../agents/critic.js";
import { optimizeImagePrompt } from "../agents/image-prompter.js";
import { research as researchAgent } from "../agents/research.js";
import {
  estimateCost,
} from "../cli/cost-estimator.js";
import { getArchetype } from "../config/archetype-registry.js";
import { getPlatformConfig } from "../config/platforms.js";
import { selectTrack } from "../providers/music/bundled.js";
import { getTotalDurationInFrames, mapScoreToProps } from "../remotion/lib/score-to-props.js";
import type { ArchetypeConfig } from "../schema/archetype.js";
import type { DirectorScore } from "../schema/director-score.js";
import type {
  LLMUsage,
  WordTimestamp,
} from "../schema/providers.js";
import type { PipelineCallbacks, PipelineOptions } from "./orchestrator.js";

// Helper to extract opts/cb from requestContext (set by runPipeline before workflow.start)
function getContext(requestContext: any): { opts: PipelineOptions; cb: PipelineCallbacks } {
  return {
    opts: requestContext.get("opts") as PipelineOptions,
    cb: (requestContext.get("cb") as PipelineCallbacks) ?? {},
  };
}

// ── Workflow Input/Output Schemas ──────────────────────────────────

const WorkflowInput = z.object({
  runDir: z.string(),
  assetsDir: z.string(),
  scorePath: z.string(),
  logPath: z.string(),
});

// Each step passes accumulated data forward as its output
const InitOutput = z.object({
  runDir: z.string(),
  assetsDir: z.string(),
  scorePath: z.string(),
  logPath: z.string(),
});

const ResearchOutput = z.object({
  summary: z.string(),
  key_facts: z.array(z.string()),
  mood: z.string(),
  sources: z.array(z.string()),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }).nullable(),
});

const DirectorOutput = z.object({
  directorScore: z.any(), // DirectorScore is complex, validated by agent
  archetypeConfig: z.any(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }),
});

const CostOutput = z.object({ proceed: z.boolean() });

const TtsOutput = z.object({
  voiceoverPath: z.string(),
  sceneWords: z.any(), // WordTimestamp[][]
  allWords: z.any(), // WordTimestamp[]
});

const VisualsOutput = z.object({
  sceneAssets: z.array(z.string().nullable()),
  sceneSourceDurations: z.array(z.number().nullable()),
  usages: z.array(z.object({ inputTokens: z.number(), outputTokens: z.number() }).nullable()),
});

const MusicOutput = z.object({
  musicFilePath: z.string().nullable(),
  musicSelection: z.any().nullable(),
});

const AssemblyOutput = z.object({ videoPath: z.string() });

const CriticOutput = z.object({
  score: z.number().nullable(),
  strengths: z.array(z.string()).nullable(),
  weaknesses: z.array(z.string()).nullable(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }).nullable(),
});

// ── Step Definitions ───────────────────────────────────────────────

export const initStep = createStep({
  id: "init",
  inputSchema: WorkflowInput,
  outputSchema: InitOutput,
  execute: async ({ inputData }) => {
    // Directories already created by runPipeline before workflow starts
    return inputData;
  },
});

export const researchStep = createStep({
  id: "research",
  inputSchema: InitOutput,
  outputSchema: ResearchOutput,
  execute: async ({ requestContext }) => {
    const { opts, cb } = getContext(requestContext);

    cb.onStageStart?.("research");
    const start = Date.now();

    try {
      const output = await researchAgent(opts.model, opts.topic);
      const dur = (Date.now() - start) / 1000;
      cb.onStageComplete?.("research", `${output.data.key_facts.length} facts`, dur);
      cb.onProgress?.("research", {
        type: "results",
        summary: output.data.summary,
        key_facts: output.data.key_facts,
        mood: output.data.mood,
      });
      return { ...output.data, usage: output.usage };
    } catch {
      cb.onStageSkip?.("research", "web search failed");
      return {
        summary: `Topic: ${opts.topic}`,
        key_facts: [],
        mood: "informative",
        sources: [],
        usage: null,
      };
    }
  },
});

export const directorStep = createStep({
  id: "director",
  inputSchema: ResearchOutput,
  outputSchema: DirectorOutput,
  execute: async ({ inputData, requestContext, getStepResult }) => {
    const { opts, cb } = getContext(requestContext);

    if (cb.isCancelled?.()) {
      throw new Error("CANCELLED");
    }

    cb.onStageStart?.("director");
    const start = Date.now();

    const researchContext = {
      summary: inputData.summary,
      key_facts: inputData.key_facts,
      mood: inputData.mood,
      sources: inputData.sources,
    };

    const cdOutput = await generateDirectorScore(opts.model, opts.topic, researchContext, {
      archetype: opts.archetype,
    });
    const directorScore = cdOutput.data;
    const dur = (Date.now() - start) / 1000;

    cb.onStageComplete?.(
      "director",
      `${directorScore.scenes.length} scenes, ${directorScore.archetype}`,
      dur,
    );

    const archetypeConfig = getArchetype(directorScore.archetype);

    // Save DirectorScore to disk
    const initData = getStepResult<{ scorePath: string }>("init");
    fs.writeFileSync(initData.scorePath, JSON.stringify(directorScore, null, 2));
    cb.onProgress?.("director", { type: "score", score: directorScore });

    return { directorScore, archetypeConfig, usage: cdOutput.usage };
  },
});

export const costEstimateStep = createStep({
  id: "costEstimate",
  inputSchema: DirectorOutput,
  outputSchema: CostOutput,
  execute: async ({ inputData, requestContext }) => {
    const { opts, cb } = getContext(requestContext);

    if (opts.dryRun) {
      cb.onStageSkip?.("tts", "dry run");
      cb.onStageSkip?.("visuals", "dry run");
      cb.onStageSkip?.("music", "dry run");
      cb.onStageSkip?.("assembly", "dry run");
      cb.onStageSkip?.("critic", "dry run");
      cb.onLog?.("\n--- DirectorScore ---");
      cb.onLog?.(JSON.stringify(inputData.directorScore, null, 2));
      return { proceed: false };
    }

    const costBreakdown = estimateCost(inputData.directorScore, opts.imageProvider, opts.ttsProvider);

    if (cb.onCostEstimate) {
      const proceed = await cb.onCostEstimate(costBreakdown, opts.imageProvider);
      if (!proceed) return { proceed: false };
    }

    if (cb.isCancelled?.()) return { proceed: false };

    return { proceed: true };
  },
});

export const ttsStep = createStep({
  id: "tts",
  inputSchema: CostOutput,
  outputSchema: TtsOutput,
  execute: async ({ inputData, requestContext, getStepResult }) => {
    if (!inputData.proceed) throw new Error("PIPELINE_STOPPED");

    const { opts, cb } = getContext(requestContext);

    if (cb.isCancelled?.()) throw new Error("CANCELLED");

    cb.onStageStart?.("tts");
    const start = Date.now();

    const director = getStepResult<{ directorScore: DirectorScore }>("director");
    const fullScript = director.directorScore.scenes.map((s: any) => s.script_line).join(" ");
    const ttsResult = await opts.tts.generate(fullScript);
    const dur = (Date.now() - start) / 1000;

    // Save audio to disk
    const initStepResult = getStepResult<{ assetsDir: string }>("init");
    const voiceoverPath = path.join(initStepResult.assetsDir, "voiceover.mp3");
    fs.writeFileSync(voiceoverPath, ttsResult.audio);

    const sceneWords = splitWordsIntoScenes(director.directorScore, ttsResult.words);
    cb.onStageComplete?.("tts", `${ttsResult.words.length} words`, dur);

    return { voiceoverPath, sceneWords, allWords: ttsResult.words };
  },
});

export const visualsStep = createStep({
  id: "visuals",
  inputSchema: TtsOutput,
  outputSchema: VisualsOutput,
  execute: async ({ requestContext, getStepResult }) => {
    const { opts, cb } = getContext(requestContext);

    if (cb.isCancelled?.()) throw new Error("CANCELLED");

    cb.onStageStart?.("visuals");
    const start = Date.now();

    const director = getStepResult<{ directorScore: DirectorScore; archetypeConfig: ArchetypeConfig }>("director");
    const initData = getStepResult<{ assetsDir: string }>("init");
    const totalScenes = director.directorScore.scenes.length;

    const sceneResults = await Promise.all(
      director.directorScore.scenes.map(async (scene: any, i: number) => {
        try {
          return await resolveVisualAsset(scene, i, totalScenes, initData.assetsDir, opts, director.archetypeConfig);
        } catch (err) {
          cb.onProgress?.("visuals", { type: "asset_failed", scene: i, error: String(err) });
          return { path: null, usage: null, durationSeconds: null };
        }
      }),
    );

    const dur = (Date.now() - start) / 1000;
    const assetCount = sceneResults.filter((r: any) => r.path).length;
    cb.onStageComplete?.("visuals", `${assetCount}/${totalScenes} assets`, dur);

    return {
      sceneAssets: sceneResults.map((r: any) => r.path),
      sceneSourceDurations: sceneResults.map((r: any) => r.durationSeconds),
      usages: sceneResults.map((r: any) => r.usage),
    };
  },
});

export const musicStep = createStep({
  id: "music",
  inputSchema: VisualsOutput,
  outputSchema: MusicOutput,
  execute: async ({ requestContext, getStepResult }) => {
    const { opts, cb } = getContext(requestContext);

    cb.onStageStart?.("music");
    const start = Date.now();

    let musicFilePath: string | null = null;
    let musicSelection: any = null;

    if (!opts.noMusic) {
      try {
        const director = getStepResult<{ directorScore: DirectorScore }>("director");
        const selection = selectTrack(director.directorScore.music_mood);
        if (selection) {
          musicFilePath = selection.filePath;
          musicSelection = selection;
        }
      } catch (err) {
        console.warn(`[workflow:music] Music selection failed: ${err}`);
      }
    }

    const dur = (Date.now() - start) / 1000;
    if (musicSelection) {
      cb.onProgress?.("music", {
        type: "selection",
        track: musicSelection.trackId,
        mood: musicSelection.mood,
        requestedMood: musicSelection.requestedMood,
        fallback: musicSelection.fallback,
      });
      cb.onStageComplete?.("music", `${musicSelection.mood} track`, dur);
    } else {
      cb.onStageSkip?.("music", opts.noMusic ? "disabled" : "no track available");
    }

    return { musicFilePath, musicSelection };
  },
});

export const assemblyStep = createStep({
  id: "assembly",
  inputSchema: MusicOutput,
  outputSchema: AssemblyOutput,
  execute: async ({ inputData, requestContext, getStepResult }) => {
    const { opts, cb } = getContext(requestContext);

    if (cb.isCancelled?.()) throw new Error("CANCELLED");

    cb.onStageStart?.("assembly");
    const start = Date.now();

    const initData = getStepResult<{ runDir: string; assetsDir: string }>("init");
    const director = getStepResult<{ directorScore: DirectorScore }>("director");
    const ttsData = getStepResult<{ voiceoverPath: string; sceneWords: WordTimestamp[][]; allWords: WordTimestamp[] }>("tts");
    const visualsData = getStepResult<{ sceneAssets: (string | null)[]; sceneSourceDurations: (number | null)[] }>("visuals");

    const platformConfig = getPlatformConfig(opts.platform);
    let { musicFilePath } = inputData;

    // Symlink assets into public dir for Remotion
    const publicDir = path.join(initData.runDir, "_remotion_public");
    fs.mkdirSync(publicDir, { recursive: true });
    const assetsLink = path.join(publicDir, "assets");
    if (fs.existsSync(assetsLink)) fs.rmSync(assetsLink, { recursive: true });
    fs.symlinkSync(path.resolve(initData.assetsDir), assetsLink);
    fs.copyFileSync(ttsData.voiceoverPath, path.join(publicDir, "voiceover.mp3"));

    if (musicFilePath) {
      try {
        fs.copyFileSync(musicFilePath, path.join(publicDir, "music.mp3"));
      } catch (err) {
        console.warn(`[workflow:assembly] Failed to copy music: ${err}`);
        musicFilePath = null;
      }
    }

    const compositionProps = mapScoreToProps(
      director.directorScore,
      {
        sceneAssets: visualsData.sceneAssets.map((a: string | null) => {
          if (!a) return null;
          return `assets/${path.basename(a)}`;
        }),
        voiceoverPath: "voiceover.mp3",
        musicPath: musicFilePath ? "music.mp3" : null,
        sceneWords: ttsData.sceneWords,
        allWords: ttsData.allWords,
        sceneSourceDurations: visualsData.sceneSourceDurations,
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

    const videoPath = path.join(initData.runDir, "final.mp4");
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

    const dur = (Date.now() - start) / 1000;
    cb.onStageComplete?.("assembly", `${(totalFrames / platformConfig.fps).toFixed(1)}s video`, dur);

    return { videoPath };
  },
});

export const criticStep = createStep({
  id: "critic",
  inputSchema: AssemblyOutput,
  outputSchema: CriticOutput,
  execute: async ({ requestContext, getStepResult }) => {
    const { opts, cb } = getContext(requestContext);

    if (cb.isCancelled?.()) throw new Error("CANCELLED");

    cb.onStageStart?.("critic");
    const start = Date.now();

    try {
      const director = getStepResult<{ directorScore: DirectorScore }>("director");
      const output = await evaluate(opts.model, director.directorScore, opts.topic);
      const critique = output.data;
      const dur = (Date.now() - start) / 1000;

      if (critique.revision_needed && critique.score < 7) {
        cb.onStageComplete?.("critic", `score ${critique.score}/10, revision needed`, dur);
        cb.onLog?.(`\nCritic score: ${critique.score}/10 — ${critique.weaknesses.join(", ")}`);
        cb.onLog?.("Revision support coming in a future release. Using current version.");
      } else {
        cb.onStageComplete?.("critic", `score ${critique.score}/10`, dur);
      }

      cb.onProgress?.("critic", {
        type: "review",
        score: critique.score,
        strengths: critique.strengths,
        weaknesses: critique.weaknesses,
      });

      return {
        score: critique.score,
        strengths: critique.strengths,
        weaknesses: critique.weaknesses,
        usage: output.usage,
      };
    } catch {
      cb.onStageSkip?.("critic", "evaluation failed");
      return { score: null, strengths: null, weaknesses: null, usage: null };
    }
  },
});

// ── Workflow Definition ────────────────────────────────────────────

export const openreelsPipeline = createWorkflow({
  id: "openreels-pipeline",
  inputSchema: WorkflowInput,
  outputSchema: CriticOutput,
})
  .then(initStep)
  .then(researchStep)
  .then(directorStep)
  .then(costEstimateStep)
  .then(ttsStep)
  .then(visualsStep)
  .then(musicStep)
  .then(assemblyStep)
  .then(criticStep)
  .commit();

// ── Helper Functions ───────────────────────────────────────────────

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
      let prompt = scene.visual_prompt;
      let usage: LLMUsage | null = null;
      try {
        const optimized = await optimizeImagePrompt(
          opts.model,
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
    case "text_card":
      return { path: null, usage: null, durationSeconds: null };
    default:
      return { path: null, usage: null, durationSeconds: null };
  }
}

function splitWordsIntoScenes(score: DirectorScore, allWords: WordTimestamp[]): WordTimestamp[][] {
  if (allWords.length === 0) return score.scenes.map(() => []);

  const wordsPerScene = score.scenes.map((s) => s.script_line.split(/\s+/).filter(Boolean).length);
  const totalExpected = wordsPerScene.reduce((sum, n) => sum + n, 0);
  const totalActual = allWords.length;

  const sceneWords: WordTimestamp[][] = [];
  let wordIndex = 0;

  for (let i = 0; i < score.scenes.length; i++) {
    const expectedCount = wordsPerScene[i] ?? 0;
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

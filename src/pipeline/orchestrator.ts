import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Mastra } from "@mastra/core";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { generateDirectorScore, reviseDirectorScore } from "../agents/creative-director.js";
import { evaluate } from "../agents/critic.js";
import { optimizeImagePrompt } from "../agents/image-prompter.js";
import { research } from "../agents/research.js";
import { resolveStockAdaptive, type StockResolution } from "../providers/stock/adaptive-resolver.js";
import { resolveAIVideo, type VideoResolution } from "../providers/video/video-resolver.js";
import type { CostBreakdown } from "../cli/cost-estimator.js";
import {
  computeActualLLMCost,
  estimateCost,
  formatActualCost,
  formatCostEstimate,
} from "../cli/cost-estimator.js";
import { ProgressDisplay } from "../cli/progress.js";
import { getArchetype } from "../config/archetype-registry.js";
import { getPlatformConfig } from "../config/platforms.js";
import { resolveMusic, type MusicResolution } from "./music-resolver.js";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { getTotalDurationInFrames, mapScoreToProps } from "../remotion/lib/score-to-props.js";
import type { ArchetypeConfig } from "../schema/archetype.js";
import type { DirectorScore } from "../schema/director-score.js";
import type {
  LLMUsage,
  WordTimestamp,
} from "../schema/providers.js";

// Re-export types and utilities from utils.ts for backward compatibility
export {
  STAGE_NAMES,
  type StageName,
  type PipelineCallbacks,
  type PipelineOptions,
  type PipelineResult,
  shouldAutoConfirm,
  shouldSkipPreview,
  splitWordsIntoScenes,
  getVideoDuration,
  confirm,
} from "./utils.js";

import {
  type StageName,
  type PipelineCallbacks,
  type PipelineOptions,
  type PipelineResult,
  STAGE_NAMES,
  shouldAutoConfirm,
  shouldSkipPreview,
  splitWordsIntoScenes,
  confirm,
} from "./utils.js";

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
    async onCostEstimate(estimate, imageProvider, stockSceneCount) {
      const output = `\n${formatCostEstimate(estimate, imageProvider, stockSceneCount)}`;
      console.log(output);
      // Tell progress display about the extra lines so the next render
      // moves the cursor past the cost estimate instead of overwriting it.
      const lineCount = output.split("\n").length;
      progress.addExtraLines(lineCount);
      if (shouldAutoConfirm(yes)) return true;
      return confirm("Proceed with generation?");
    },
    onActualCost(cost) {
      const output = `\n${formatActualCost(cost)}`;
      console.log(output);
      progress.addExtraLines(output.split("\n").length);
    },
    onLog(message) {
      console.log(message);
      progress.addExtraLines(message.split("\n").length);
    },
  };

  return { callbacks, progress };
}

// ──────────────────────────────────────────────────────────────────────────────
// Run log tracking (written to log.json in the finally handler)
// ──────────────────────────────────────────────────────────────────────────────

interface RunLog {
  topic: string;
  startedAt: string;
  stages: { name: string; duration: number; status: string; error?: string }[];
  totalCost?: { estimated: number; actual?: number };
  stockResolutions?: StockResolution[];
  videoResolutions?: VideoResolution[];
  musicResolution?: { provider: string; prompt?: string; metadata?: Record<string, unknown>; fallback: boolean };
  direction?: string;
  replay?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Visual asset resolution (used by the visuals step)
// ──────────────────────────────────────────────────────────────────────────────

interface VisualAssetResult {
  path: string | null;
  usage: LLMUsage | null;
  durationSeconds: number | null;
  stockResolution?: StockResolution;
  videoResolution?: VideoResolution;
  prompterUsage?: LLMUsage | null;
}

/** Generate an AI image with optional rejection context from failed stock searches */
async function generateAIImage(
  opts: PipelineOptions,
  visualPrompt: string,
  scriptLine: string,
  sceneIndex: number,
  totalScenes: number,
  archetype: ArchetypeConfig,
  assetsDir: string,
): Promise<VisualAssetResult> {
  let prompt = visualPrompt;
  let usage: LLMUsage | null = null;
  try {
    const optimized = await optimizeImagePrompt(
      opts.llm,
      visualPrompt,
      scriptLine,
      sceneIndex,
      totalScenes,
      archetype,
    );
    prompt = optimized.prompt;
    usage = optimized.usage;
  } catch (err) {
    console.warn(`[visuals] Scene ${sceneIndex} prompt optimization failed, using original: ${err}`);
  }

  try {
    const imageBuffer = await opts.imageGen.generate(prompt);
    const filePath = path.join(assetsDir, `scene-${sceneIndex}-ai.png`);
    fs.writeFileSync(filePath, imageBuffer);
    return { path: filePath, usage, durationSeconds: null };
  } catch (err) {
    if (!isSafetyRejection(err)) throw err;

    // Safety rejection: retry once with a sanitized prompt
    console.warn(`[visuals] Scene ${sceneIndex} image rejected by safety filter, retrying with softened prompt`);
    try {
      const sanitized = await optimizeImagePrompt(
        opts.llm,
        visualPrompt,
        scriptLine,
        sceneIndex,
        totalScenes,
        archetype,
        {
          rejectionContext:
            `The previous prompt was rejected by the image provider's safety filter (${String(err).slice(0, 200)}). ` +
            `Rewrite the prompt to convey the same scene mood and composition through atmosphere, lighting, and implication. ` +
            `Remove ALL references to violence, blood, gore, weapons in use, suffering, nudity, or graphic content. ` +
            `Keep the archetype style and emotional tone intact.`,
        },
      );
      prompt = sanitized.prompt;
      usage = sanitized.usage;
    } catch {
      // If the LLM sanitization call itself fails, re-throw the original safety error
      throw err;
    }

    const imageBuffer = await opts.imageGen.generate(prompt);
    const filePath = path.join(assetsDir, `scene-${sceneIndex}-ai.png`);
    fs.writeFileSync(filePath, imageBuffer);
    return { path: filePath, usage, durationSeconds: null };
  }
}

function isSafetyRejection(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("safety") ||
    msg.includes("content policy") ||
    msg.includes("safety_violations") ||
    msg.includes("rejected by the safety") ||
    msg.includes("content moderation") ||
    msg.includes("prohibited content")
  );
}

async function resolveVisualAsset(
  scene: DirectorScore["scenes"][number],
  index: number,
  totalScenes: number,
  assetsDir: string,
  opts: PipelineOptions,
  archetype: ArchetypeConfig,
  cb: PipelineCallbacks,
  sceneDurationSeconds?: number,
): Promise<VisualAssetResult> {
  switch (scene.visual_type) {
    case "ai_image":
      return generateAIImage(opts, scene.visual_prompt, scene.script_line, index, totalScenes, archetype, assetsDir);

    case "stock_image":
    case "stock_video": {
      const stockVerify = opts.stockVerify !== false;
      const result = await resolveStockAdaptive(
        scene.visual_type,
        scene.visual_prompt,
        scene.script_line,
        index,
        totalScenes,
        assetsDir,
        {
          llm: opts.llm,
          imageGen: opts.imageGen,
          stocks: opts.stock,
          verifyModel: stockVerify ? (opts.verifyModel ?? null) : null,
          confidenceThreshold: opts.stockConfidence ?? 0.6,
          maxAttempts: opts.stockMaxAttempts ?? 4,
          callbacks: cb,
          archetype,
        },
      );
      return {
        path: result.path,
        usage: result.usage,
        durationSeconds: result.durationSeconds,
        stockResolution: result.resolution,
      };
    }

    case "ai_video": {
      // If no video providers available, fall back to ai_image silently
      if (!opts.videoProviders?.length) {
        return generateAIImage(opts, scene.visual_prompt, scene.script_line, index, totalScenes, archetype, assetsDir);
      }
      // Phase 1: Generate AI image (first frame)
      const imageStart = Date.now();
      const imgResult = await generateAIImage(opts, scene.visual_prompt, scene.script_line, index, totalScenes, archetype, assetsDir);
      const imageGenTimeMs = Date.now() - imageStart;
      const imageBuffer = fs.readFileSync(imgResult.path!);

      // Phase 2: Animate with video provider via resolver
      const videoResult = await resolveAIVideo(scene, {
        path: imgResult.path!,
        buffer: imageBuffer,
        usage: imgResult.usage,
      }, index, assetsDir, {
        videoProviders: opts.videoProviders,
        llm: opts.llm,
        archetype,
        callbacks: cb,
        totalScenes,
        sceneDurationSeconds,
      });

      // Adjust imageGenTimeMs in the resolution metadata
      if (videoResult.videoResolution) {
        videoResult.videoResolution.imageGenTimeMs = imageGenTimeMs;
      }

      return {
        path: videoResult.path,
        usage: videoResult.usage,
        durationSeconds: videoResult.durationSeconds,
        videoResolution: videoResult.videoResolution,
        prompterUsage: videoResult.prompterUsage ?? null,
      };
    }

    case "text_card":
      return { path: null, usage: null, durationSeconds: null };

    default:
      return { path: null, usage: null, durationSeconds: null };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Mastra pipeline workflow
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a Mastra workflow for the OpenReels pipeline.
 *
 * Steps receive providers and callbacks via closure (not serializable through
 * Mastra state). Each step calls PipelineCallbacks directly for domain events
 * (research results, director scores, cost estimates, etc.).
 *
 * Data flows between steps via Mastra's input/output chaining (.then()).
 * Shared mutable state (llmUsages, log) lives in the runPipeline scope.
 */
function buildPipelineWorkflow(
  opts: PipelineOptions,
  cb: PipelineCallbacks,
  runDir: string,
  assetsDir: string,
  scorePath: string,
  llmUsages: LLMUsage[],
  log: RunLog,
) {
  // Shared mutable state accessed by steps via closure.
  // Declared here (top of function) so the data flow is visible before the steps.
  // Steps close over these bindings — values are set during execution, not at definition time.
  // Non-serializable data (providers, callbacks) can't pass through Mastra's stateSchema,
  // so steps receive them via closure and share intermediate results through these objects.
  const directorResult: {
    score?: DirectorScore;
    config?: ArchetypeConfig;
    costBreakdown?: CostBreakdown;
    dryRunExit?: boolean;
    costRejected?: boolean;
  } = {};

  const ttsResult: {
    words?: WordTimestamp[];
    voiceoverPath?: string;
    sceneWords?: WordTimestamp[][];
  } = {};

  const visualsResult: {
    sceneAssets: (string | null)[];
    sceneSourceDurations: (number | null)[];
    musicFilePath?: string | null;
    musicSelection?: { trackId: string; mood: string; requestedMood: string; fallback: boolean } | null;
    musicResolution?: MusicResolution | null;
  } = { sceneAssets: [], sceneSourceDurations: [] };

  const assemblyResult: { videoPath?: string | null } = {};

  // ── Step 1: Research ────────────────────────────────────────────────────
  const researchStep = createStep({
    id: "research",
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({
      summary: z.string(),
      key_facts: z.array(z.string()),
      mood: z.string(),
      sources: z.array(z.string()),
    }),
    execute: async ({ inputData }) => {
      // Replay mode: skip research entirely
      if (opts.replayScore) {
        cb.onStageSkip?.("research", "Replaying from saved score");
        log.stages.push({ name: "research", duration: 0, status: "skipped" });
        return {
          summary: `Topic: ${inputData.topic}`,
          key_facts: [] as string[],
          mood: "informative",
          sources: [] as string[],
        };
      }

      cb.onStageStart?.("research");
      const start = Date.now();
      try {
        const output = await research(opts.llm, inputData.topic);
        llmUsages.push(output.usage);
        const dur = (Date.now() - start) / 1000;
        cb.onStageComplete?.("research", `${output.data.key_facts.length} facts`, dur);
        cb.onProgress?.("research", {
          type: "results",
          summary: output.data.summary,
          key_facts: output.data.key_facts,
          mood: output.data.mood,
        });
        log.stages.push({ name: "research", duration: dur, status: "done" });
        return output.data;
      } catch (err) {
        const dur = (Date.now() - start) / 1000;
        cb.onStageSkip?.("research", "web search failed");
        log.stages.push({ name: "research", duration: dur, status: "skipped", error: String(err) });
        return {
          summary: `Topic: ${inputData.topic}`,
          key_facts: [] as string[],
          mood: "informative",
          sources: [] as string[],
        };
      }
    },
  });

  // ── Step 2: Creative Director ───────────────────────────────────────────
  const directorStep = createStep({
    id: "director",
    inputSchema: z.object({
      summary: z.string(),
      key_facts: z.array(z.string()),
      mood: z.string(),
      sources: z.array(z.string()),
    }),
    outputSchema: z.object({ done: z.boolean() }),
    execute: async ({ inputData }) => {
      if (cb.isCancelled?.()) return { done: false };

      cb.onStageStart?.("director");
      const start = Date.now();
      const videoEnabled = !opts.noVideo && (opts.videoProviders?.length ?? 0) > 0;
      const directorOpts = { archetype: opts.archetype, pacing: opts.pacing, videoEnabled, direction: opts.direction };

      // ── Replay mode: use provided score, skip generation + revision ──
      if (opts.replayScore) {
        const score = opts.replayScore;
        directorResult.score = score;
        directorResult.config = getArchetype(score.archetype);

        fs.writeFileSync(scorePath, JSON.stringify(score, null, 2));
        cb.onProgress?.("director", { type: "score", score });

        // Dry run during replay
        if (opts.dryRun) {
          const dur = (Date.now() - start) / 1000;
          cb.onStageComplete?.("director", "Replayed from saved score", dur);
          log.stages.push({ name: "creative-director", duration: dur, status: "done" });
          cb.onStageSkip?.("tts", "dry run");
          cb.onStageSkip?.("visuals", "dry run");
          cb.onStageSkip?.("assembly", "dry run");
          cb.onStageSkip?.("critic", "dry run");
          cb.onLog?.("\n--- DirectorScore (replayed) ---");
          cb.onLog?.(JSON.stringify(score, null, 2));
          directorResult.dryRunExit = true;
          return { done: true };
        }

        // Cost estimation with replay flag (omits research/director/critic LLM costs)
        const costBreakdown = estimateCost(score, opts.imageProvider, opts.ttsProvider, opts.videoProvider, opts.llm.id, opts.musicProviderKey, 0, 0, { replay: true });
        directorResult.costBreakdown = costBreakdown;
        log.totalCost = { estimated: costBreakdown.totalCost };

        if (cb.onCostEstimate) {
          const stockSceneCount = score.scenes.filter(
            (s) => s.visual_type === "stock_image" || s.visual_type === "stock_video",
          ).length;
          const proceed = await cb.onCostEstimate(costBreakdown, opts.imageProvider, stockSceneCount);
          if (!proceed) {
            directorResult.costRejected = true;
            return { done: true };
          }
        }

        const dur = (Date.now() - start) / 1000;
        cb.onStageComplete?.("director", `Replayed: ${score.scenes.length} scenes, ${score.archetype}`, dur);
        log.stages.push({ name: "creative-director", duration: dur, status: "done" });
        return { done: true };
      }

      // ── Generate initial DirectorScore ──
      const cdOutput = await generateDirectorScore(opts.llm, opts.topic, inputData, directorOpts);
      llmUsages.push(cdOutput.usage);
      let score = cdOutput.data;

      // ── Revision loop: evaluate → revise until score >= 7 or max rounds ──
      //
      //   generate ──► evaluate ──► score >= 7? ──YES──► done
      //                   │
      //                  NO (round < MAX)
      //                   │
      //                revise ──► re-evaluate ──► ...
      //
      // Tracks the highest-scoring revision (LLM refinement can degrade in later rounds).
      const MAX_REVISION_ROUNDS = 2;
      let bestScore = score;
      let bestCritiqueScore = 0;
      let revisionRoundsCompleted = 0;

      let evaluationsCompleted = 0;

      for (let round = 0; round < MAX_REVISION_ROUNDS; round++) {
        try {
          const critiqueOutput = await evaluate(opts.llm, score, opts.topic, opts.pacing);
          llmUsages.push(critiqueOutput.usage);
          evaluationsCompleted++;
          const critique = critiqueOutput.data;

          // Track highest-scoring revision
          if (critique.score > bestCritiqueScore) {
            bestScore = score;
            bestCritiqueScore = critique.score;
          }

          if (critique.score >= 7 || !critique.revision_needed) break;

          cb.onProgress?.("director", { type: "revision", round: round + 1, critiqueScore: critique.score });
          cb.onLog?.(`\n[director] Critic score: ${critique.score}/10 (round ${round + 1}), revising...`);

          const revised = await reviseDirectorScore(opts.llm, opts.topic, inputData, score, critique, directorOpts);
          llmUsages.push(revised.usage);
          score = revised.data;
          revisionRoundsCompleted++;
        } catch (err) {
          // Graceful degradation: if the critic or revision fails, proceed with current best score
          console.warn(`[director] Revision round ${round + 1} failed: ${err}`);
          break;
        }
      }

      // Final evaluation: if the last revision was never scored (loop exhausted),
      // give it a chance to compete with bestScore
      if (revisionRoundsCompleted > 0 && score !== bestScore) {
        try {
          const finalCritique = await evaluate(opts.llm, score, opts.topic, opts.pacing);
          llmUsages.push(finalCritique.usage);
          evaluationsCompleted++;
          if (finalCritique.data.score > bestCritiqueScore) {
            bestScore = score;
            bestCritiqueScore = finalCritique.data.score;
          }
        } catch {
          // If final evaluation fails, bestScore from the loop is still valid
        }
      }

      // Use the highest-scoring revision
      score = bestScore;

      // ── Store final score on shared closure state ──
      directorResult.score = score;
      directorResult.config = getArchetype(score.archetype);

      const dur = (Date.now() - start) / 1000;
      cb.onStageComplete?.(
        "director",
        `${score.scenes.length} scenes, ${score.archetype}`,
        dur,
      );
      log.stages.push({ name: "creative-director", duration: dur, status: "done" });

      // Write score.json and emit progress AFTER the revision loop
      fs.writeFileSync(scorePath, JSON.stringify(score, null, 2));
      cb.onProgress?.("director", { type: "score", score });

      // Dry run handling (after revision loop so --dry-run shows revised score)
      if (opts.dryRun) {
        cb.onStageSkip?.("tts", "dry run");
        cb.onStageSkip?.("visuals", "dry run");
        cb.onStageSkip?.("assembly", "dry run");
        cb.onStageSkip?.("critic", "dry run");
        cb.onLog?.("\n--- DirectorScore ---");
        cb.onLog?.(JSON.stringify(score, null, 2));
        directorResult.dryRunExit = true;
        return { done: true };
      }

      // Cost estimation (uses the final revised score for accurate scene counts)
      // Pass evaluations and revisions separately: evaluations count critic calls,
      // revisions count director calls (evaluations >= revisions since gate always evaluates)
      const costBreakdown = estimateCost(score, opts.imageProvider, opts.ttsProvider, opts.videoProvider, opts.llm.id, opts.musicProviderKey, evaluationsCompleted, revisionRoundsCompleted);
      directorResult.costBreakdown = costBreakdown;
      log.totalCost = { estimated: costBreakdown.totalCost };

      if (cb.onCostEstimate) {
        const stockSceneCount = score.scenes.filter(
          (s) => s.visual_type === "stock_image" || s.visual_type === "stock_video",
        ).length;
        const proceed = await cb.onCostEstimate(costBreakdown, opts.imageProvider, stockSceneCount);
        if (!proceed) {
          directorResult.costRejected = true;
          return { done: true };
        }
      }

      return { done: true };
    },
  });

  // ── Step 3: TTS ─────────────────────────────────────────────────────────
  const ttsStep = createStep({
    id: "tts",
    inputSchema: z.object({ done: z.boolean() }),
    outputSchema: z.object({ done: z.boolean() }),
    execute: async () => {
      if (cb.isCancelled?.() || directorResult.dryRunExit || directorResult.costRejected) {
        return { done: false };
      }

      const score = directorResult.score!;
      cb.onStageStart?.("tts");
      const start = Date.now();
      const fullScript = score.scenes.map((s) => s.script_line).join(" ");
      const result = await opts.tts.generate(fullScript);
      const dur = (Date.now() - start) / 1000;

      const voiceoverPath = path.join(assetsDir, "voiceover.mp3");
      fs.writeFileSync(voiceoverPath, result.audio);

      ttsResult.words = result.words;
      ttsResult.voiceoverPath = voiceoverPath;
      ttsResult.sceneWords = splitWordsIntoScenes(score, result.words);

      cb.onStageComplete?.("tts", `${result.words.length} words`, dur);
      log.stages.push({ name: "tts", duration: dur, status: "done" });
      return { done: true };
    },
  });

  // ── Step 4: Visual Assets (parallel internally) ─────────────────────────
  const visualsStep = createStep({
    id: "visuals",
    inputSchema: z.object({ done: z.boolean() }),
    outputSchema: z.object({ done: z.boolean() }),
    execute: async () => {
      if (cb.isCancelled?.() || directorResult.dryRunExit || directorResult.costRejected) {
        return { done: false };
      }

      const score = directorResult.score!;
      const archetype = directorResult.config!;
      cb.onStageStart?.("visuals");
      const start = Date.now();
      const totalScenes = score.scenes.length;

      // Compute scene durations from TTS word timings for visual assets and music
      const sceneDurations = (ttsResult.sceneWords ?? []).map((words) => {
        const first = words?.[0];
        const last = words?.[words.length - 1];
        return first && last ? last.end - first.start + 0.5 : 3;
      });

      // Run visual asset resolution and music generation in parallel
      const scenePromise = Promise.all(
        score.scenes.map(async (scene, i) => {
          try {
            const sceneDuration = sceneDurations[i];
            return await resolveVisualAsset(scene, i, totalScenes, assetsDir, opts, archetype, cb, sceneDuration);
          } catch (err) {
            cb.onProgress?.("visuals", { type: "asset_failed", scene: i, error: String(err) });
            return { path: null, usage: null, durationSeconds: null } as VisualAssetResult;
          }
        }),
      );

      const musicPromise = resolveMusic(score, sceneDurations, {
        musicProvider: opts.musicProvider!,
        musicProviderKey: opts.musicProviderKey ?? "bundled",
        llm: opts.llm,
        noMusic: opts.noMusic,
        callbacks: cb,
      });

      const [sceneResults, musicResult] = await Promise.all([scenePromise, musicPromise]);

      visualsResult.sceneAssets = sceneResults.map((r) => r.path);
      visualsResult.sceneSourceDurations = sceneResults.map((r) => r.durationSeconds);
      for (const r of sceneResults) {
        if (r.usage) llmUsages.push(r.usage);
        if (r.prompterUsage) llmUsages.push(r.prompterUsage);
      }

      // Track music prompter LLM usage
      if (musicResult?.prompterUsage) {
        llmUsages.push(musicResult.prompterUsage);
      }

      // Store music result and emit progress event for worker meta.json
      if (musicResult) {
        visualsResult.musicFilePath = musicResult.filePath;
        visualsResult.musicResolution = musicResult;
        // Backward-compatible musicSelection for existing progress events
        visualsResult.musicSelection = {
          trackId: musicResult.provider === "lyria" ? "lyria-generated" : "bundled",
          mood: score.music_mood,
          requestedMood: score.music_mood,
          fallback: musicResult.fallback,
        };
        // Emit full music metadata for worker to persist in meta.json
        cb.onProgress?.("visuals", {
          type: "music_resolved",
          provider: musicResult.provider,
          prompt: musicResult.prompt,
          metadata: musicResult.metadata,
          fallback: musicResult.fallback,
        });
      }

      // Collect stock resolution metadata for log.json
      const stockResolutions = sceneResults
        .map((r) => r.stockResolution)
        .filter((sr): sr is StockResolution => sr != null);
      if (stockResolutions.length > 0) {
        log.stockResolutions = stockResolutions;
      }

      // Collect video resolution metadata for log.json
      const videoResolutions = sceneResults
        .map((r) => r.videoResolution)
        .filter((vr): vr is VideoResolution => vr != null);
      if (videoResolutions.length > 0) {
        log.videoResolutions = videoResolutions;
      }

      // Write music resolution metadata to log.json
      if (musicResult) {
        log.musicResolution = {
          provider: musicResult.provider,
          prompt: musicResult.prompt,
          metadata: musicResult.metadata,
          fallback: musicResult.fallback,
        };
      }

      const dur = (Date.now() - start) / 1000;
      const assetCount = visualsResult.sceneAssets.filter(Boolean).length;
      cb.onStageComplete?.("visuals", `${assetCount}/${totalScenes} assets`, dur);
      log.stages.push({ name: "visuals", duration: dur, status: "done" });

      return { done: true };
    },
  });

  // ── Step 5: Remotion Assembly ───────────────────────────────────────────
  const assemblyStep = createStep({
    id: "assembly",
    inputSchema: z.object({ done: z.boolean() }),
    outputSchema: z.object({ done: z.boolean() }),
    execute: async () => {
      if (cb.isCancelled?.() || directorResult.dryRunExit || directorResult.costRejected) {
        return { done: false };
      }

      const score = directorResult.score!;
      cb.onStageStart?.("assembly");

      if (visualsResult.musicSelection) {
        cb.onProgress?.("assembly", {
          type: "music",
          track: visualsResult.musicSelection.trackId,
          mood: visualsResult.musicSelection.mood,
          requestedMood: visualsResult.musicSelection.requestedMood,
          fallback: visualsResult.musicSelection.fallback,
        });
      }

      const start = Date.now();
      const platformConfig = getPlatformConfig(opts.platform);

      // Symlink assets into a temp public dir for Remotion to serve via staticFile()
      const publicDir = path.join(runDir, "_remotion_public");
      fs.mkdirSync(publicDir, { recursive: true });
      const assetsLink = path.join(publicDir, "assets");
      if (fs.existsSync(assetsLink)) fs.rmSync(assetsLink, { recursive: true });
      fs.symlinkSync(path.resolve(assetsDir), assetsLink);

      fs.copyFileSync(ttsResult.voiceoverPath!, path.join(publicDir, "voiceover.mp3"));

      let musicFilePath = visualsResult.musicFilePath;
      if (musicFilePath) {
        try {
          fs.copyFileSync(musicFilePath, path.join(publicDir, "music.mp3"));
          // Clean up temp file from Lyria to prevent /tmp disk fill on servers
          if (musicFilePath.includes(os.tmpdir())) {
            try { fs.unlinkSync(musicFilePath); } catch { /* ignore cleanup error */ }
          }
        } catch (err) {
          console.warn(`[orchestrator] Failed to copy music file, proceeding without music: ${err}`);
          musicFilePath = null;
        }
      }

      const compositionProps = mapScoreToProps(
        score,
        {
          sceneAssets: visualsResult.sceneAssets.map((a) => {
            if (!a) return null;
            return `assets/${path.basename(a)}`;
          }),
          voiceoverPath: "voiceover.mp3",
          musicPath: musicFilePath ? "music.mp3" : null,
          sceneWords: ttsResult.sceneWords!,
          allWords: ttsResult.words!,
          sceneSourceDurations: visualsResult.sceneSourceDurations,
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

      assemblyResult.videoPath = path.join(runDir, "final.mp4");
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
        outputLocation: assemblyResult.videoPath,
        inputProps: compositionProps as unknown as Record<string, unknown>,
      });

      const dur = (Date.now() - start) / 1000;
      cb.onStageComplete?.(
        "assembly",
        `${(totalFrames / platformConfig.fps).toFixed(1)}s video`,
        dur,
      );
      log.stages.push({ name: "assembly", duration: dur, status: "done" });
      return { done: true };
    },
  });

  // ── Step 6: Critic ──────────────────────────────────────────────────────
  const criticStep = createStep({
    id: "critic",
    inputSchema: z.object({ done: z.boolean() }),
    outputSchema: z.object({ done: z.boolean() }),
    execute: async () => {
      if (cb.isCancelled?.() || directorResult.dryRunExit || directorResult.costRejected) {
        return { done: false };
      }

      // Replay mode: skip critic (it evaluates the score text, not the rendered video)
      if (opts.replayScore) {
        cb.onStageSkip?.("critic", "Replaying from saved score");
        log.stages.push({ name: "critic", duration: 0, status: "skipped" });
        return { done: true };
      }

      const score = directorResult.score!;
      cb.onStageStart?.("critic");
      const start = Date.now();
      try {
        const critiqueOutput = await evaluate(opts.llm, score, opts.topic, opts.pacing);
        const critique = critiqueOutput.data;
        llmUsages.push(critiqueOutput.usage);
        const dur = (Date.now() - start) / 1000;

        cb.onStageComplete?.("critic", `score ${critique.score}/10`, dur);
        cb.onProgress?.("critic", {
          type: "review",
          score: critique.score,
          strengths: critique.strengths,
          weaknesses: critique.weaknesses,
        });
        log.stages.push({ name: "critic", duration: dur, status: "done" });
      } catch (err) {
        const dur = (Date.now() - start) / 1000;
        cb.onStageSkip?.("critic", "evaluation failed");
        log.stages.push({ name: "critic", duration: dur, status: "skipped", error: String(err) });
      }

      return { done: true };
    },
  });

  // Build the workflow graph
  const workflow = createWorkflow({
    id: "openreels-pipeline",
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ done: z.boolean() }),
  })
    .then(researchStep)
    .then(directorStep)
    .then(ttsStep)
    .then(visualsStep)
    .then(assemblyStep)
    .then(criticStep)
    .commit();

  return { workflow, directorResult, ttsResult, visualsResult, assemblyResult };
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API — preserved for backward compatibility with worker.ts and index.ts
// ──────────────────────────────────────────────────────────────────────────────

export async function runPipeline(
  opts: PipelineOptions,
  callbacks?: PipelineCallbacks,
): Promise<PipelineResult> {
  const cb = callbacks ?? {};
  const log: RunLog = {
    topic: opts.topic,
    startedAt: new Date().toISOString(),
    stages: [],
    ...(opts.direction ? { direction: opts.direction } : {}),
    ...(opts.replayScore ? { replay: true } : {}),
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

  // Notify caller of runDir so it can be persisted before any stage runs
  cb.onRunDir?.(runDir);

  const logPath = path.join(runDir, "log.json");
  const scorePath = path.join(runDir, "score.json");

  // Track all LLM token usage for actual cost reporting
  const llmUsages: LLMUsage[] = [];

  try {
    // Build Mastra workflow with steps that close over opts, callbacks, and shared state
    const { workflow, directorResult, visualsResult, assemblyResult } = buildPipelineWorkflow(
      opts,
      cb,
      runDir,
      assetsDir,
      scorePath,
      llmUsages,
      log,
    );

    // Create Mastra instance and execute the workflow
    const mastra = new Mastra({ workflows: { pipeline: workflow } });
    const wf = mastra.getWorkflow("pipeline");
    const run = await wf.createRun();
    const result = await run.start({ inputData: { topic: opts.topic } });

    if (result.status === "failed") {
      const failedStep = Object.entries(result.steps).find(
        ([, s]) => (s as { status: string }).status === "failed",
      );
      if (failedStep) {
        const stepData = failedStep[1] as { error?: string };
        throw new Error(`Pipeline step "${failedStep[0]}" failed: ${stepData.error ?? "unknown"}`);
      }
      throw new Error("Pipeline workflow failed");
    }

    // Early exits (dry run or cost rejected) — no video produced
    if (directorResult.dryRunExit || directorResult.costRejected) {
      return { outputDir: runDir, videoPath: null, thumbnailPath: null, scorePath, logPath };
    }

    const videoPath = assemblyResult.videoPath ?? null;

    // Compute and report actual cost (only if we got past director stage)
    if (directorResult.score && directorResult.costBreakdown) {
      const score = directorResult.score;
      // Count actual AI images produced (includes stock→AI fallbacks + ai_video Phase 1)
      const aiImageFiles = visualsResult.sceneAssets.filter(
        (a) => a != null && a.endsWith("-ai.png"),
      ).length;
      // ai_video scenes also generate a Phase 1 AI image even when video succeeds
      const aiVideoScenes = visualsResult.sceneAssets.filter(
        (a) => a != null && a.endsWith("-ai-video.mp4"),
      ).length;
      const aiImages = aiImageFiles + aiVideoScenes;
      const ttsCharacters = score.scenes.reduce((sum, s) => sum + s.script_line.length, 0);
      const musicGenerated = visualsResult.musicResolution?.provider === "lyria";
      const actualCost = computeActualLLMCost(
        llmUsages,
        { aiImages, ttsCharacters, aiVideos: aiVideoScenes, musicGenerated },
        opts.llm.id,
        opts.imageProvider,
        opts.ttsProvider,
        opts.videoProvider,
        opts.musicProviderKey,
      );
      log.totalCost = {
        estimated: directorResult.costBreakdown.totalCost,
        actual: actualCost.totalCost,
      };
      cb.onActualCost?.(actualCost);
    }

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

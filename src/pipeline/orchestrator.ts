/**
 * Pipeline orchestrator — thin wrapper around the Mastra workflow.
 *
 * Exports the same PipelineOptions/PipelineCallbacks/PipelineResult interface
 * for backward compatibility with worker.ts and index.ts. Internally creates
 * and executes the Mastra workflow graph defined in workflow.ts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { LanguageModel } from "ai";
import { RequestContext } from "@mastra/core/di";
import { openreelsPipeline } from "./workflow.js";
import {
  computeActualLLMCost,
} from "../cli/cost-estimator.js";
import type { ActualCostBreakdown, CostBreakdown } from "../cli/cost-estimator.js";
import type {
  ImageProvider,
  ImageProviderKey,
  LLMProviderKey,
  LLMUsage,
  StockProvider,
  TTSProvider,
  TTSProviderKey,
} from "../schema/providers.js";

// Stage names matching the pipeline execution order
export const STAGE_NAMES = [
  "research",
  "director",
  "tts",
  "visuals",
  "music",
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

export interface PipelineOptions {
  topic: string;
  model: LanguageModel;
  llmProvider: LLMProviderKey;
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

/**
 * Run the full OpenReels pipeline via Mastra workflow graph.
 *
 * Creates the run directory, then executes the workflow:
 *   init → research → director → costEstimate → tts → visuals → music → assembly → critic
 *
 * Each stage is a Mastra createStep() node. State flows through getStepResult().
 */
export async function runPipeline(
  opts: PipelineOptions,
  callbacks?: PipelineCallbacks,
): Promise<PipelineResult> {
  const cb = callbacks ?? {};

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

  // Run log for the finally block
  const log = {
    topic: opts.topic,
    startedAt: new Date().toISOString(),
    stages: [] as { name: string; duration: number; status: string; error?: string }[],
    totalCost: undefined as { estimated: number; actual?: number } | undefined,
  };

  try {
    // Execute the Mastra workflow graph
    const requestContext = new RequestContext();
    requestContext.set("opts", opts);
    requestContext.set("cb", cb);

    const run = await openreelsPipeline.createRun();
    const result = await run.start({
      inputData: { runDir, assetsDir, scorePath, logPath },
      requestContext,
    });

    if (result.status === "failed") {
      const err = result.error;
      // Check if this is a controlled stop (dry run, cost rejected, cancelled)
      if (err?.message === "PIPELINE_STOPPED" || err?.message === "CANCELLED") {
        return { outputDir: runDir, videoPath: null, thumbnailPath: null, scorePath, logPath };
      }
      throw err instanceof Error ? err : new Error(String(err));
    }

    // Extract results from workflow steps (cast to any — steps are typed at runtime)
    const steps = result.steps as Record<string, any>;
    const videoPath = steps?.assembly?.output?.videoPath ?? null;

    // Compute actual cost from accumulated LLM usages across steps
    const llmUsages: LLMUsage[] = [];
    if (steps?.research?.output?.usage) llmUsages.push(steps.research.output.usage);
    if (steps?.director?.output?.usage) llmUsages.push(steps.director.output.usage);
    if (steps?.critic?.output?.usage) llmUsages.push(steps.critic.output.usage);
    // Visual step usages (from image prompt optimization)
    const visualUsages = steps?.visuals?.output?.usages;
    if (Array.isArray(visualUsages)) {
      for (const u of visualUsages) {
        if (u) llmUsages.push(u);
      }
    }

    // Cost reporting
    if (llmUsages.length > 0 && steps?.director?.output?.directorScore) {
      const directorScore = steps.director.output.directorScore;
      const aiImages = directorScore.scenes?.filter((s: any) => s.visual_type === "ai_image").length ?? 0;
      const ttsCharacters = directorScore.scenes?.reduce((sum: number, s: any) => sum + (s.script_line?.length ?? 0), 0) ?? 0;
      const actualCost = computeActualLLMCost(
        llmUsages,
        { aiImages, ttsCharacters },
        opts.llmProvider,
        opts.imageProvider,
        opts.ttsProvider,
      );
      cb.onActualCost?.(actualCost);
    }

    // Preview (CLI only)
    if (opts.preview && videoPath) {
      if (!process.stdin.isTTY) {
        cb.onLog?.("\n--preview requires an interactive terminal (skipped in Docker/CI).");
      } else {
        cb.onLog?.("\nOpening Remotion Studio preview...");
        try {
          const { execFileSync } = await import("node:child_process");
          execFileSync("npx", ["remotion", "studio"], { stdio: "inherit" });
        } catch {
          cb.onLog?.("Preview closed or failed to open.");
        }
      }
    }

    cb.onLog?.(`\nOutput: ${runDir}`);
    if (videoPath) cb.onLog?.(`  Video:     ${videoPath}`);
    cb.onLog?.(`  Score:     ${scorePath}`);
    cb.onLog?.(`  Log:       ${logPath}`);

    return { outputDir: runDir, videoPath, thumbnailPath: null, scorePath, logPath };
  } finally {
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  }
}

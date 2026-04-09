import * as fs from "node:fs";
import * as path from "node:path";
import { type Job, Worker } from "bullmq";
import IORedis from "ioredis";
import type { PipelineCallbacks, StageName } from "./pipeline/orchestrator.js";
import { runPipeline } from "./pipeline/orchestrator.js";
import { createProviders, createVerificationModel } from "./providers/factory.js";
import { validateManifest } from "./providers/music/bundled.js";
import type {
  ImageProviderKey,
  LLMProviderKey,
  MusicProviderKey,
  StockProviderKey,
  TTSProviderKey,
  VideoProviderKey,
} from "./schema/providers.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const JOBS_DIR = process.env["JOBS_DIR"] ?? path.join(process.cwd(), "jobs");
const MAX_JOBS = process.env["MAX_JOBS"] ? Number(process.env["MAX_JOBS"]) : 0;

fs.mkdirSync(JOBS_DIR, { recursive: true });

const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// Validate music manifest at startup — warn but don't crash
try {
  const { valid, missing } = validateManifest();
  if (!valid) {
    console.warn(
      `[worker] Music manifest warning: ${missing.length} tracks missing: ${missing.join(", ")}`,
    );
  }
} catch {
  // Music manifest not available — music selection will gracefully degrade
}

interface JobData {
  topic: string;
  archetype?: string;
  pacing?: string;
  platform: string;
  dryRun: boolean;
  noMusic?: boolean;
  noVideo?: boolean;
  providers: {
    llm: string;
    tts: string;
    image: string;
    stock: string;
    video?: string;
    videoModel?: string;
    music?: string;
    llmModel?: string;
    llmBaseUrl?: string;
    searchProvider?: string;
  };
  keys: Record<string, string>;
  jobsDir: string;
}

interface JobMeta {
  id: string;
  topic: string;
  archetype?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  cancelRequested?: boolean;
  stages: Record<string, { status: string; detail?: string; durationSec?: number }>;
  costEstimate?: unknown;
  actualCost?: unknown;
  videoPath?: string;
  runDir?: string;
  researchData?: { summary: string; key_facts: string[]; mood: string };
  score?: unknown; // DirectorScore
  criticReview?: { score: number; strengths: string[]; weaknesses: string[] };
  musicTrack?: { trackId: string; mood: string; requestedMood: string; fallback: boolean };
  musicGeneration?: {
    provider: string;
    prompt?: string;
    metadata?: Record<string, unknown>;
    fallback: boolean;
  };
  revisionHistory?: { round: number; score: number }[];
  error?: string;
}

function writeMeta(jobDir: string, meta: JobMeta) {
  const tmpPath = jobDir + "/.meta.tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(meta, null, 2));
  fs.renameSync(tmpPath, path.join(jobDir, "meta.json"));
}

const worker = new Worker<JobData>(
  "openreels",
  async (job: Job<JobData>) => {
    const { topic, archetype, pacing, platform, dryRun, noMusic, noVideo, providers, keys } =
      job.data;
    const jobDir = path.join(JOBS_DIR, job.id!);
    fs.mkdirSync(jobDir, { recursive: true });

    // Initialize meta
    const meta: JobMeta = {
      id: job.id!,
      topic,
      archetype,
      status: "running",
      createdAt: new Date().toISOString(),
      stages: {},
    };

    // Initialize all stages as pending
    for (const name of ["research", "director", "tts", "visuals", "assembly", "critic"]) {
      meta.stages[name] = { status: "pending" };
    }
    writeMeta(jobDir, meta);

    // Create providers with per-job keys
    const providerInstances = createProviders({
      llm: providers.llm as LLMProviderKey,
      tts: providers.tts as TTSProviderKey,
      image: providers.image as ImageProviderKey,
      stock: providers.stock as StockProviderKey,
      video: providers.video as VideoProviderKey | undefined,
      videoModel: providers.videoModel,
      music: (providers.music as MusicProviderKey) ?? "bundled",
      keys,
      llmModel: providers.llmModel,
      llmBaseUrl: providers.llmBaseUrl,
      searchProvider: providers.searchProvider as
        | import("./schema/providers.js").SearchProviderKey
        | undefined,
    });

    // Build callbacks that emit BullMQ progress events and update meta.json
    const callbacks: PipelineCallbacks = {
      onRunDir(runDir: string) {
        meta.runDir = path.relative(jobDir, runDir);
        writeMeta(jobDir, meta);
      },

      onStageStart(stage: StageName) {
        meta.stages[stage] = { status: "running" };
        writeMeta(jobDir, meta);
        job.updateProgress({ stage, type: "start" });
      },

      onStageComplete(stage: StageName, detail: string, durationSec: number) {
        meta.stages[stage] = { status: "done", detail, durationSec };
        writeMeta(jobDir, meta);
        job.updateProgress({ stage, type: "complete", detail, durationSec });
      },

      onStageSkip(stage: StageName, reason: string) {
        meta.stages[stage] = { status: "skipped", detail: reason };
        writeMeta(jobDir, meta);
        job.updateProgress({ stage, type: "skipped", reason });
      },

      onStageError(stage: StageName, error: string) {
        meta.stages[stage] = { status: "error", detail: error };
        writeMeta(jobDir, meta);
        job.updateProgress({ stage, type: "error", error });
      },

      onProgress(stage: StageName, data: Record<string, unknown>) {
        // Store rich data in meta for SSE reconnection support
        if (data.type === "results") {
          meta.researchData = {
            summary: data.summary as string,
            key_facts: data.key_facts as string[],
            mood: data.mood as string,
          };
          writeMeta(jobDir, meta);
        } else if (data.type === "score") {
          meta.score = data.score;
          writeMeta(jobDir, meta);
        } else if (data.type === "music") {
          meta.musicTrack = {
            trackId: data.track as string,
            mood: data.mood as string,
            requestedMood: data.requestedMood as string,
            fallback: data.fallback as boolean,
          };
          writeMeta(jobDir, meta);
        } else if (data.type === "music_resolved") {
          meta.musicGeneration = {
            provider: data.provider as string,
            prompt: data.prompt as string | undefined,
            metadata: data.metadata as Record<string, unknown> | undefined,
            fallback: data.fallback as boolean,
          };
          writeMeta(jobDir, meta);
        } else if (data.type === "revision") {
          if (!meta.revisionHistory) meta.revisionHistory = [];
          meta.revisionHistory.push({
            round: data.round as number,
            score: data.critiqueScore as number,
          });
          writeMeta(jobDir, meta);
        } else if (data.type === "review") {
          meta.criticReview = {
            score: data.score as number,
            strengths: data.strengths as string[],
            weaknesses: data.weaknesses as string[],
          };
          writeMeta(jobDir, meta);
        }
        job.updateProgress({ stage, ...data });
      },

      async onCostEstimate(estimate) {
        meta.costEstimate = estimate;
        writeMeta(jobDir, meta);
        job.updateProgress({ stage: "director", type: "cost_estimate", estimate });
        // Auto-confirm in worker mode (no interactive prompt)
        return true;
      },

      onActualCost(cost) {
        meta.actualCost = cost;
        writeMeta(jobDir, meta);
      },

      onLog(message: string) {
        // Worker logs go to stdout (captured by Docker logs)
        console.log(`[job:${job.id}] ${message}`);
      },

      isCancelled() {
        // Check meta.json for cancel flag and sync back to in-memory meta
        try {
          const currentMeta = JSON.parse(fs.readFileSync(path.join(jobDir, "meta.json"), "utf-8"));
          if (currentMeta.cancelRequested === true) {
            meta.cancelRequested = true;
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    };

    // Create verification model with per-job API keys
    const LLM_KEY_MAP: Record<string, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GOOGLE_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      "openai-compatible": "OPENREELS_LLM_API_KEY",
    };
    const llmKeyName = LLM_KEY_MAP[providers.llm] ?? "ANTHROPIC_API_KEY";
    const llmKey = keys[llmKeyName];
    const verifyModel = createVerificationModel(
      providers.llm as LLMProviderKey,
      providers.llmModel,
      llmKey,
    );

    // Run the pipeline
    const result = await runPipeline(
      {
        topic,
        llm: providerInstances.llm,
        tts: providerInstances.tts,
        ttsProvider: providers.tts as TTSProviderKey,
        imageGen: providerInstances.imageGen,
        imageProvider: providers.image as ImageProviderKey,
        stock: providerInstances.stock,
        videoProviders: noVideo ? [] : providerInstances.videoProviders,
        videoProvider: providers.video as VideoProviderKey | undefined,
        noVideo: noVideo === true,
        archetype,
        pacing,
        platform,
        dryRun,
        noMusic,
        musicProvider: providerInstances.music,
        musicProviderKey: (providers.music as MusicProviderKey) ?? "bundled",
        preview: false,
        outputDir: jobDir,
        yes: true,
        verifyModel,
      },
      callbacks,
    );

    // Update final meta
    meta.status = meta.cancelRequested ? "cancelled" : "completed";
    meta.completedAt = new Date().toISOString();
    if (result.videoPath) {
      meta.videoPath = path.relative(jobDir, result.videoPath);
      // Store runDir explicitly for frontend artifact fetching
      meta.runDir = path.relative(jobDir, result.outputDir);
    }
    writeMeta(jobDir, meta);

    // Auto-prune old jobs if MAX_JOBS is set
    if (MAX_JOBS > 0) {
      pruneOldJobs(JOBS_DIR, MAX_JOBS);
    }

    return { videoPath: result.videoPath, outputDir: result.outputDir };
  },
  {
    connection: redis,
    concurrency: 1,
    lockDuration: 600_000, // 10 minutes — Remotion renders can be slow
  },
);

function pruneOldJobs(jobsDir: string, maxJobs: number) {
  const dirs = fs
    .readdirSync(jobsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const metaPath = path.join(jobsDir, d.name, "meta.json");
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        return { id: d.name, status: meta.status, createdAt: meta.createdAt ?? "" };
      } catch {
        return { id: d.name, status: "unknown", createdAt: "" };
      }
    })
    .filter(
      (j) =>
        j.status === "completed" ||
        j.status === "failed" ||
        j.status === "cancelled" ||
        j.status === "unknown",
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  while (dirs.length > maxJobs) {
    const oldest = dirs.shift();
    if (oldest) {
      fs.rmSync(path.join(jobsDir, oldest.id), { recursive: true, force: true });
      console.log(`[pruner] Removed old job: ${oldest.id}`);
    }
  }
}

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);

  // Update meta to reflect failure (atomic write to prevent corruption)
  if (job?.id) {
    const jobDir = path.join(JOBS_DIR, job.id);
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(jobDir, "meta.json"), "utf-8"));
      meta.status = meta.cancelRequested ? "cancelled" : "failed";
      meta.error = err.message;
      meta.completedAt = new Date().toISOString();
      // Mark whatever stage was "running" as "error" so the UI can identify it
      if (meta.stages) {
        for (const stage of Object.keys(meta.stages)) {
          if (meta.stages[stage].status === "running") {
            meta.stages[stage] = { status: "error", detail: err.message };
          }
        }
      }
      writeMeta(jobDir, meta);
    } catch {}
  }
});

console.log("OpenReels worker started, waiting for jobs...");

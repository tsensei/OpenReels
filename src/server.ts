import * as fs from "node:fs";
import * as path from "node:path";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { Queue, QueueEvents } from "bullmq";
import Fastify from "fastify";
import IORedis from "ioredis";
import { getArchetype, listArchetypes } from "./config/archetype-registry.js";
import { PLATFORMS } from "./config/platforms.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const JOBS_DIR = process.env["JOBS_DIR"] ?? path.join(process.cwd(), "jobs");
const MAX_JOBS = process.env["MAX_JOBS"] ? Number(process.env["MAX_JOBS"]) : 0;
const WEB_DIST = path.join(process.cwd(), "web", "dist");

// Ensure jobs directory exists
fs.mkdirSync(JOBS_DIR, { recursive: true });

/** Validate job ID to prevent path traversal — must be alphanumeric/hyphen/underscore only */
function isValidJobId(id: string): boolean {
  return /^[\w-]+$/.test(id);
}

const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue("openreels", { connection: redis });
const queueEvents = new QueueEvents("openreels", { connection: redis.duplicate() });

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Serve job artifacts from the jobs directory
await app.register(fastifyStatic, {
  root: JOBS_DIR,
  prefix: "/api/v1/jobs/",
  serve: false, // we handle serving manually for path traversal protection
});

// --- Health check ---
app.get("/api/v1/health", async () => {
  let redisOk = false;
  try {
    await redis.ping();
    redisOk = true;
  } catch {}

  const jobsDirStats = fs.statSync(JOBS_DIR, { throwIfNoEntry: false });

  return {
    status: redisOk ? "healthy" : "degraded",
    redis: redisOk ? "connected" : "disconnected",
    jobsDir: jobsDirStats ? "exists" : "missing",
  };
});

// --- Archetypes ---
app.get("/api/v1/archetypes", async () => {
  const names = listArchetypes();
  return names.map((name) => {
    const config = getArchetype(name);
    return {
      name,
      captionStyle: config.captionStyle,
      artStyle: config.artStyle,
      mood: config.mood,
    };
  });
});

// --- Platforms ---
app.get("/api/v1/platforms", async () => {
  return Object.entries(PLATFORMS).map(([name, config]) => ({
    name,
    width: config.width,
    height: config.height,
    fps: config.fps,
    maxDurationSeconds: config.maxDurationSeconds,
  }));
});

// --- Providers list ---
app.get("/api/v1/providers", async () => ({
  llm: [
    { key: "anthropic", label: "Anthropic (Claude)" },
    { key: "openai", label: "OpenAI (GPT)" },
    { key: "gemini", label: "Google Gemini" },
  ],
  tts: [
    { key: "elevenlabs", label: "ElevenLabs" },
    { key: "inworld", label: "Inworld" },
    { key: "kokoro", label: "Kokoro (Local)" },
    { key: "gemini-tts", label: "Gemini TTS" },
    { key: "openai-tts", label: "OpenAI TTS" },
  ],
  image: [
    { key: "gemini", label: "Google Gemini" },
    { key: "openai", label: "OpenAI (GPT Image)" },
  ],
  video: [
    { key: "gemini", label: "Google Veo" },
    { key: "fal", label: "fal.ai (Kling, Wan, etc.)" },
  ],
}));

// --- Job creation ---
interface CreateJobBody {
  topic: string;
  archetype?: string;
  pacing?: string;
  platform?: string;
  dryRun?: boolean;
  noMusic?: boolean;
  noVideo?: boolean;
  providers?: {
    llm?: string;
    tts?: string;
    image?: string;
    stock?: string;
    video?: string;
    videoModel?: string;
    music?: string;
  };
  keys?: Record<string, string>;
}

app.post<{ Body: CreateJobBody }>("/api/v1/jobs", async (request, reply) => {
  const { topic, archetype, pacing, platform, dryRun, noMusic, noVideo, providers, keys } = request.body ?? {};

  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return reply.status(400).send({ error: "topic is required" });
  }
  if (topic.trim().length > 500) {
    return reply.status(400).send({ error: "topic must be 500 characters or fewer" });
  }

  // Validate archetype if provided
  if (archetype) {
    try {
      getArchetype(archetype);
    } catch {
      return reply.status(400).send({ error: `Unknown archetype: ${archetype}` });
    }
  }

  // Validate pacing tier if provided
  const validPacingTiers = ["fast", "moderate", "cinematic"];
  if (pacing && !validPacingTiers.includes(pacing)) {
    return reply
      .status(400)
      .send({ error: `Unknown pacing tier: ${pacing}. Available: ${validPacingTiers.join(", ")}` });
  }

  // Validate platform if provided
  const validPlatforms = Object.keys(PLATFORMS);
  if (platform && !validPlatforms.includes(platform)) {
    return reply
      .status(400)
      .send({ error: `Unknown platform: ${platform}. Available: ${validPlatforms.join(", ")}` });
  }

  const job = await queue.add("render", {
    topic: topic.trim(),
    archetype,
    pacing,
    platform: platform ?? "youtube",
    dryRun: dryRun ?? false,
    noMusic: noMusic === true,
    noVideo: noVideo === true,
    providers: {
      llm: providers?.llm ?? "anthropic",
      tts: providers?.tts ?? "elevenlabs",
      image: providers?.image ?? "gemini",
      stock: providers?.stock ?? "pexels",
      video: providers?.video,
      videoModel: providers?.videoModel,
      music: providers?.music ?? "bundled",
    },
    keys: keys ?? {},
    jobsDir: JOBS_DIR,
  });

  // Create placeholder meta.json so GET /jobs/:id never 404s for a queued job
  const jobDir = path.join(JOBS_DIR, job.id!);
  fs.mkdirSync(jobDir, { recursive: true });
  const placeholderMeta = {
    id: job.id,
    topic: topic.trim(),
    archetype,
    status: "queued",
    createdAt: new Date().toISOString(),
    stages: Object.fromEntries(
      ["research", "director", "tts", "visuals", "assembly", "critic"].map((s) => [
        s,
        { status: "pending" },
      ]),
    ),
  };
  fs.writeFileSync(path.join(jobDir, "meta.json"), JSON.stringify(placeholderMeta, null, 2));

  return reply.status(201).send({
    id: job.id,
    topic: topic.trim(),
    archetype,
    status: "queued",
  });
});

// --- Job listing ---
app.get("/api/v1/jobs", async (request) => {
  const { limit = "20", offset = "0" } = request.query as Record<string, string>;
  const limitNum = Math.min(Number(limit) || 20, 100);
  const offsetNum = Number(offset) || 0;

  if (!fs.existsSync(JOBS_DIR)) return { jobs: [], total: 0 };

  const dirs = fs
    .readdirSync(JOBS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const metaPath = path.join(JOBS_DIR, d.name, "meta.json");
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        return { id: d.name, ...meta };
      } catch {
        return { id: d.name, status: "unknown" };
      }
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return {
    jobs: dirs.slice(offsetNum, offsetNum + limitNum),
    total: dirs.length,
  };
});

// --- Job detail ---
app.get<{ Params: { id: string } }>("/api/v1/jobs/:id", async (request, reply) => {
  if (!isValidJobId(request.params.id)) {
    return reply.status(400).send({ error: "Invalid job ID" });
  }
  const jobDir = path.join(JOBS_DIR, request.params.id);
  const metaPath = path.join(jobDir, "meta.json");

  if (!fs.existsSync(metaPath)) {
    return reply.status(404).send({ error: "Job not found" });
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  return meta;
});

// --- Job SSE events ---
app.get<{ Params: { id: string } }>("/api/v1/jobs/:id/events", async (request, reply) => {
  if (!isValidJobId(request.params.id)) {
    return reply.status(400).send({ error: "Invalid job ID" });
  }
  const jobId = request.params.id;

  // Check if job exists in BullMQ
  const jobDir = path.join(JOBS_DIR, jobId);
  const metaPath = path.join(jobDir, "meta.json");
  const job = await queue.getJob(jobId);
  if (!job) {
    // Job may have been cleaned from BullMQ (Redis restart, etc.) — fallback to meta.json
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        if (meta.status === "completed" || meta.status === "failed" || meta.status === "cancelled") {
          reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          reply.raw.write(`event: job:snapshot\ndata: ${JSON.stringify(meta)}\n\n`);
          const terminalEvent = meta.status === "completed" ? "job:completed" : "job:failed";
          reply.raw.write(`event: ${terminalEvent}\ndata: ${JSON.stringify({ state: meta.status })}\n\n`);
          reply.raw.end();
          return;
        }
      } catch {}
    }
    return reply.status(404).send({ error: "Job not found" });
  }

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send current state as snapshot
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      reply.raw.write(`event: job:snapshot\ndata: ${JSON.stringify(meta)}\n\n`);
    } catch {}
  }

  // If job is already finished, send completion and close
  const state = await job.getState();
  if (state === "completed" || state === "failed") {
    reply.raw.write(`event: job:${state}\ndata: ${JSON.stringify({ state })}\n\n`);
    reply.raw.end();
    return;
  }

  // Guard against double-cleanup (client disconnect + job complete can race)
  let cleaned = false;

  // Listen for progress updates
  const onProgress = ({ jobId: progressJobId, data }: { jobId: string; data: unknown }) => {
    if (cleaned || progressJobId !== jobId) return;
    try {
      const eventData = data as Record<string, unknown>;
      const stage = eventData.stage as string;
      reply.raw.write(`event: stage:${stage}\ndata: ${JSON.stringify(eventData)}\n\n`);
    } catch {}
  };

  const onCompleted = ({ jobId: completedJobId }: { jobId: string }) => {
    if (completedJobId === jobId) {
      try { reply.raw.write(`event: job:completed\ndata: {}\n\n`); } catch {}
      cleanup();
    }
  };

  const onFailed = ({
    jobId: failedJobId,
    failedReason,
  }: {
    jobId: string;
    failedReason: string;
  }) => {
    if (failedJobId === jobId) {
      try { reply.raw.write(`event: job:failed\ndata: ${JSON.stringify({ error: failedReason })}\n\n`); } catch {}
      cleanup();
    }
  };

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    queueEvents.off("progress", onProgress);
    queueEvents.off("completed", onCompleted);
    queueEvents.off("failed", onFailed);
    try { reply.raw.end(); } catch {}
  };

  queueEvents.on("progress", onProgress);
  queueEvents.on("completed", onCompleted);
  queueEvents.on("failed", onFailed);

  // Cleanup on client disconnect
  request.raw.on("close", cleanup);
});

// --- Artifact serving (with path traversal protection) ---
app.get<{ Params: { id: string; "*": string } }>(
  "/api/v1/jobs/:id/artifacts/*",
  async (request, reply) => {
    const jobId = request.params.id;
    if (!isValidJobId(jobId)) {
      return reply.status(400).send({ error: "Invalid job ID" });
    }
    const artifactPath = request.params["*"];

    const jobDir = path.join(JOBS_DIR, jobId);
    const fullPath = path.resolve(jobDir, artifactPath);

    // Path traversal protection: ensure resolved path is within the job directory
    if (
      !fullPath.startsWith(path.resolve(jobDir) + path.sep) &&
      fullPath !== path.resolve(jobDir)
    ) {
      return reply.status(403).send({ error: "Access denied" });
    }

    if (!fs.existsSync(fullPath)) {
      return reply.status(404).send({ error: "Artifact not found" });
    }

    return reply.sendFile(path.relative(JOBS_DIR, fullPath), JOBS_DIR);
  },
);

// --- Job cancellation ---
app.post<{ Params: { id: string } }>("/api/v1/jobs/:id/cancel", async (request, reply) => {
  if (!isValidJobId(request.params.id)) {
    return reply.status(400).send({ error: "Invalid job ID" });
  }
  const job = await queue.getJob(request.params.id);
  if (!job) {
    return reply.status(404).send({ error: "Job not found" });
  }

  const state = await job.getState();
  if (state === "completed" || state === "failed") {
    return reply.status(409).send({ error: `Job already ${state}` });
  }

  // Update meta to mark as cancelling (atomic write: tmp + rename)
  const jobDir = path.join(JOBS_DIR, request.params.id);
  const metaPath = path.join(jobDir, "meta.json");
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      meta.cancelRequested = true;
      const tmpPath = path.join(jobDir, ".meta.tmp");
      fs.writeFileSync(tmpPath, JSON.stringify(meta, null, 2));
      fs.renameSync(tmpPath, metaPath);
    } catch {}
  }

  // moveToFailed handles queued jobs; for active jobs the token won't match
  // the worker's lock, so we catch and rely on cancelRequested flag instead
  try {
    await job.moveToFailed(new Error("Cancelled by user"), "0", true);
  } catch {}
  return { status: "cancelled" };
});

// --- Job deletion ---
app.delete<{ Params: { id: string } }>("/api/v1/jobs/:id", async (request, reply) => {
  const jobId = request.params.id;
  if (!isValidJobId(jobId)) {
    return reply.status(400).send({ error: "Invalid job ID" });
  }
  const jobDir = path.join(JOBS_DIR, jobId);

  if (!fs.existsSync(jobDir)) {
    return reply.status(404).send({ error: "Job not found" });
  }

  // Don't delete active jobs
  const job = await queue.getJob(jobId);
  if (job) {
    const state = await job.getState();
    if (state === "active" || state === "waiting") {
      return reply.status(409).send({ error: "Cannot delete an active job" });
    }
    await job.remove();
  }

  fs.rmSync(jobDir, { recursive: true, force: true });
  return { status: "deleted" };
});

// --- Auto-pruning helper ---
async function pruneOldJobs() {
  if (MAX_JOBS <= 0) return;

  const dirs = fs
    .readdirSync(JOBS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const metaPath = path.join(JOBS_DIR, d.name, "meta.json");
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        return { id: d.name, status: meta.status, createdAt: meta.createdAt ?? "" };
      } catch {
        return { id: d.name, status: "unknown", createdAt: "" };
      }
    })
    .filter((j) => j.status === "completed" || j.status === "failed" || j.status === "cancelled" || j.status === "unknown")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  while (dirs.length > MAX_JOBS) {
    const oldest = dirs.shift();
    if (oldest) {
      fs.rmSync(path.join(JOBS_DIR, oldest.id), { recursive: true, force: true });
    }
  }
}

// Export for worker to call after job completion
export { JOBS_DIR, MAX_JOBS, pruneOldJobs };

// --- Serve frontend SPA ---
if (fs.existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, {
    root: WEB_DIST,
    prefix: "/",
    decorateReply: false,
    wildcard: false,
  });

  // SPA fallback: serve index.html for all non-API routes
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html", WEB_DIST);
  });
}

// --- Start server ---
try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`OpenReels API server running on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

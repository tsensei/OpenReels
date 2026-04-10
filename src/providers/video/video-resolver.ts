import * as fs from "node:fs";
import * as path from "node:path";
import pLimit from "p-limit";
import type { ArchetypeConfig } from "../../schema/archetype.js";
import type { DirectorScore } from "../../schema/director-score.js";
import type {
  LLMProvider,
  LLMUsage,
  VideoProvider,
} from "../../schema/providers.js";
import type { PipelineCallbacks } from "../../pipeline/utils.js";
import { optimizeImagePrompt } from "../../agents/image-prompter.js";

export interface VideoResolution {
  method: "image_to_video" | "image_fallback";
  provider: string;
  durationSeconds: number | null;
  error?: string;
  imageGenTimeMs: number;
  videoGenTimeMs: number | null;
  motionPrompt?: string;
  negativePrompt?: string;
}

// Module-level concurrency limiter for video gen API calls
const videoGenLimit = pLimit(3);

const DEFAULT_VIDEO_NEGATIVES =
  "blur, low resolution, flickering, compression artifacts, frame drops, jitter, stutter, warping, morphing, unnatural physics, deformed hands, extra fingers, morphing faces, sliding motion";

/**
 * Pick the smallest supported duration that is >= the target.
 * If target exceeds all supported durations, pick the max (trim, never loop).
 */
function pickDuration(supportedDurations: number[], targetSeconds: number): number {
  const sorted = [...supportedDurations].sort((a, b) => a - b);
  for (const d of sorted) {
    if (d >= targetSeconds) return d;
  }
  return sorted[sorted.length - 1] ?? 5;
}

export async function resolveAIVideo(
  scene: DirectorScore["scenes"][number],
  imageResult: { path: string; buffer: Buffer; usage: LLMUsage | null },
  sceneIndex: number,
  assetsDir: string,
  opts: {
    videoProviders: VideoProvider[];
    llm: LLMProvider;
    archetype: ArchetypeConfig;
    callbacks: PipelineCallbacks;
    sceneDurationSeconds?: number;
    totalScenes?: number;
  },
): Promise<{
  path: string;
  usage: LLMUsage | null;
  durationSeconds: number | null;
  videoResolution: VideoResolution;
}> {
  const imageGenTimeMs = 0; // Already tracked by caller

  // Generate motion-aware prompt via LLM
  let motionPrompt = scene.visual_prompt;
  try {
    const optimized = await optimizeImagePrompt(
      opts.llm,
      scene.visual_prompt,
      scene.script_line,
      sceneIndex,
      opts.totalScenes ?? 1,
      opts.archetype,
      { mode: "video" },
    );
    motionPrompt = optimized.prompt;
  } catch (err) {
    console.warn(`[video] Scene ${sceneIndex} motion prompt gen failed, using visual_prompt: ${err}`);
  }

  opts.callbacks.onProgress?.("visuals", { type: "video_image_ready", scene: sceneIndex });

  // Construct negative prompt: defaults + archetype anti-artifact guidance
  const archetypeGuidance = opts.archetype.antiArtifactGuidance?.trim();
  const negativePrompt = archetypeGuidance
    ? `${DEFAULT_VIDEO_NEGATIVES}, ${archetypeGuidance}`
    : DEFAULT_VIDEO_NEGATIVES;

  // Try each video provider in order
  for (let i = 0; i < opts.videoProviders.length; i++) {
    const provider = opts.videoProviders[i]!;
    const providerName = i === 0 ? "primary" : "secondary";
    const targetDuration = opts.sceneDurationSeconds ?? 5;
    const genDuration = pickDuration(provider.supportedDurations, targetDuration);

    try {
      const videoStart = Date.now();
      const videoResult = await videoGenLimit(() =>
        provider.generate({
          sourceImage: imageResult.buffer,
          prompt: motionPrompt,
          durationSeconds: genDuration,
          aspectRatio: "9:16",
          negativePrompt,
        }),
      );
      const videoGenTimeMs = Date.now() - videoStart;

      // Copy video to assets dir and clean up temp file
      const videoPath = path.join(assetsDir, `scene-${sceneIndex}-ai-video.mp4`);
      fs.copyFileSync(videoResult.filePath, videoPath);
      try {
        fs.unlinkSync(videoResult.filePath);
      } catch {
        // Temp file cleanup is best-effort
      }

      opts.callbacks.onProgress?.("visuals", {
        type: "video_generated",
        scene: sceneIndex,
        durationSeconds: videoResult.durationSeconds,
        provider: providerName,
      });

      return {
        path: videoPath,
        usage: imageResult.usage,
        durationSeconds: videoResult.durationSeconds,
        videoResolution: {
          method: "image_to_video",
          provider: providerName,
          durationSeconds: videoResult.durationSeconds,
          imageGenTimeMs,
          videoGenTimeMs,
          motionPrompt,
          negativePrompt,
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[video] Scene ${sceneIndex} ${providerName} provider failed: ${errorMsg}`);

      // If this is the last provider, fall through to image fallback
      if (i === opts.videoProviders.length - 1) {
        opts.callbacks.onProgress?.("visuals", {
          type: "video_fallback",
          scene: sceneIndex,
          reason: errorMsg,
        });

        return {
          path: imageResult.path,
          usage: imageResult.usage,
          durationSeconds: null,
          videoResolution: {
            method: "image_fallback",
            provider: "none",
            durationSeconds: null,
            error: errorMsg,
            imageGenTimeMs,
            videoGenTimeMs: null,
          },
        };
      }
      // Otherwise try next provider
    }
  }

  // Should not reach here, but fallback to image just in case
  return {
    path: imageResult.path,
    usage: imageResult.usage,
    durationSeconds: null,
    videoResolution: {
      method: "image_fallback",
      provider: "none",
      durationSeconds: null,
      error: "No video providers available",
      imageGenTimeMs,
      videoGenTimeMs: null,
    },
  };
}

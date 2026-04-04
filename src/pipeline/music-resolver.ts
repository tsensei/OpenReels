import { getArchetype } from "../config/archetype-registry.js";
import { generateMusicPrompt } from "../agents/music-prompter.js";
import { BundledMusic } from "../providers/music/bundled-adapter.js";
import type { DirectorScore, MusicMood } from "../schema/director-score.js";
import type { LLMProvider, LLMUsage, MusicProvider, MusicResult } from "../schema/providers.js";
import type { PipelineCallbacks } from "./utils.js";

const MAX_LYRIA_DURATION = 180; // Lyria 3 Pro max ~3 minutes
const DURATION_PADDING = 5; // Request slightly longer to avoid loop

export interface MusicResolution {
  filePath: string;
  provider: "lyria" | "bundled";
  fallback: boolean;
  prompt?: string;
  metadata?: Record<string, unknown>;
  prompterUsage?: LLMUsage;
}

/**
 * Resolve background music for a video.
 *
 *   LLM prompter ──▶ Lyria API ──▶ audio file
 *       │                │
 *       │          on failure ──▶ BundledMusic fallback
 *       │
 *   on failure ──▶ BundledMusic fallback
 *
 * Returns null if noMusic is true or all fallbacks fail.
 */
export async function resolveMusic(
  score: DirectorScore,
  sceneDurations: number[],
  opts: {
    musicProvider: MusicProvider;
    musicProviderKey: string;
    llm: LLMProvider;
    noMusic?: boolean;
    callbacks?: PipelineCallbacks;
  },
): Promise<MusicResolution | null> {
  if (opts.noMusic) return null;

  const cb = opts.callbacks;
  const mood = score.music_mood;

  // Bundled provider — no LLM call needed
  if (opts.musicProviderKey === "bundled") {
    try {
      const result = await opts.musicProvider.generate("", mood);
      return {
        filePath: result.filePath,
        provider: "bundled",
        fallback: false,
      };
    } catch (err) {
      console.warn(`[music-resolver] Bundled music selection failed: ${err}`);
      return null;
    }
  }

  // AI music generation (Lyria)
  cb?.onProgress?.("visuals", { type: "music_generating", provider: opts.musicProviderKey });

  try {
    // Compute total duration with cap
    const totalRawDuration = sceneDurations.reduce((sum, d) => sum + d, 0);
    const totalDuration = Math.min(totalRawDuration + DURATION_PADDING, MAX_LYRIA_DURATION);

    // Step 1: LLM generates music prompt
    const archetype = getArchetype(score.archetype);
    const promptResult = await generateMusicPrompt(opts.llm, {
      musicMood: mood,
      emotionalArc: score.emotional_arc,
      archetype: score.archetype,
      archetypeMood: archetype.mood,
      sceneDurations,
      sceneNarratives: score.scenes.map((s) => s.script_line),
      totalDurationSeconds: totalDuration,
    });

    // Step 2: Lyria generates audio
    const result = await opts.musicProvider.generate(promptResult.prompt, mood);

    cb?.onProgress?.("visuals", {
      type: "music_generated",
      provider: opts.musicProviderKey,
      durationSeconds: result.durationSeconds,
    });

    return {
      filePath: result.filePath,
      provider: "lyria",
      fallback: false,
      prompt: promptResult.prompt,
      metadata: result.metadata,
      prompterUsage: promptResult.usage,
    };
  } catch (err) {
    console.warn(`[music-resolver] AI music generation failed, falling back to bundled: ${err}`);
    cb?.onProgress?.("visuals", {
      type: "music_fallback",
      reason: String(err),
    });

    // Fallback to bundled
    return fallbackToBundled(mood);
  }
}

async function fallbackToBundled(mood: MusicMood): Promise<MusicResolution | null> {
  try {
    const bundled = new BundledMusic();
    const result = await bundled.generate("", mood);
    return {
      filePath: result.filePath,
      provider: "bundled",
      fallback: true,
    };
  } catch (err) {
    console.warn(`[music-resolver] Bundled fallback also failed: ${err}`);
    return null;
  }
}

import { getArchetype } from "../../config/archetype-registry.js";
import type { ArchetypeConfig } from "../../schema/archetype";
import type { DirectorScore, TransitionType } from "../../schema/director-score";
import type { WordTimestamp } from "../../schema/providers";

export interface SceneProps {
  visualType: string;
  assetSrc: string | null;
  motion: string;
  visualPrompt: string;
  durationInFrames: number;
  words: WordTimestamp[];
  colorPalette?: ArchetypeConfig["colorPalette"];
  textCardFont?: string;
  motionIntensity?: number;
  startFrom?: number;
  sourceDurationInSeconds?: number;
  transition: TransitionType;
  transitionDurationFrames: number;
}

export interface CompositionProps {
  scenes: SceneProps[];
  captionStyle: string;
  voiceoverSrc: string | null;
  musicSrc: string | null;
  // Absolute word timestamps for the entire voiceover (timeline-centric captions + music ducking)
  allWords: WordTimestamp[];
}

export interface ResolvedAssets {
  sceneAssets: (string | null)[];
  voiceoverPath: string | null;
  musicPath: string | null;
  sceneWords: WordTimestamp[][]; // per-scene words (for duration calculation only)
  allWords: WordTimestamp[]; // full absolute timestamps from TTS
  sceneSourceDurations: (number | null)[]; // source video durations in seconds (stock_video only)
}

export function mapScoreToProps(
  score: DirectorScore,
  assets: ResolvedAssets,
  fps: number = 30,
): CompositionProps {
  const archetype = getArchetype(score.archetype);

  const scenes: SceneProps[] = score.scenes.map((scene, i) => {
    const words = assets.sceneWords[i] ?? [];
    // Duration = voiceover duration for this scene, minimum 2 seconds
    const lastWord = words[words.length - 1];
    const firstWord = words[0];
    const voiceoverDuration = lastWord && firstWord ? lastWord.end - firstWord.start : 3;
    const durationSeconds = Math.max(voiceoverDuration + 0.5, 2);
    const durationInFrames = Math.round(durationSeconds * fps);

    return {
      visualType: scene.visual_type,
      assetSrc: assets.sceneAssets[i] ?? null,
      motion: scene.motion,
      visualPrompt: scene.visual_prompt,
      durationInFrames,
      words, // per-scene words kept for scene duration calc, not used for captions
      colorPalette: archetype.colorPalette,
      textCardFont: archetype.textCardFont,
      motionIntensity: archetype.motionIntensity,
      startFrom: 0,
      sourceDurationInSeconds: assets.sceneSourceDurations[i] ?? undefined,
      transition: scene.transition ?? archetype.defaultTransition ?? "none",
      transitionDurationFrames: archetype.transitionDurationFrames ?? 15,
    };
  });

  return {
    scenes,
    captionStyle: archetype.captionStyle,
    voiceoverSrc: assets.voiceoverPath,
    musicSrc: assets.musicPath,
    allWords: assets.allWords, // absolute timestamps for captions + music ducking (computed in MusicTrack component)
  };
}

export function getTotalDurationInFrames(props: CompositionProps, fps: number = 30): number {
  const sceneDuration = props.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
  const transitionOverlap = props.scenes.reduce((sum, s, i) => {
    if (i < props.scenes.length - 1 && s.transition !== "none") {
      return sum + s.transitionDurationFrames;
    }
    return sum;
  }, 0);

  const adjusted = sceneDuration - transitionOverlap;

  // Voiceover is the spine — composition must be at least as long as voiceover.
  // If overlap causes a deficit, extend the last scene to fill the visual gap.
  const voiceoverEnd = props.allWords[props.allWords.length - 1]?.end ?? 0;
  const minFrames = Math.ceil(voiceoverEnd * fps);

  // WARNING: This mutates props.scenes[last].durationInFrames to prevent black frames.
  // Only call once per render pass. Calling twice on the same props will grow the last scene unboundedly.
  const lastScene = props.scenes[props.scenes.length - 1];
  if (adjusted < minFrames && lastScene) {
    const deficit = minFrames - adjusted;
    lastScene.durationInFrames += deficit;
    return minFrames;
  }

  return adjusted;
}

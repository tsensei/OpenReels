import type { DirectorScore } from "../../schema/director-score";
import type { ArchetypeConfig } from "../../schema/archetype";
import type { WordTimestamp } from "../../schema/providers";
import { getArchetype } from "../../config/archetype-registry.js";

export interface SceneProps {
  visualType: string;
  assetSrc: string | null;
  motion: string;
  textOverlay: string | null;
  durationInFrames: number;
  words: WordTimestamp[];
  colorPalette?: ArchetypeConfig["colorPalette"];
  textCardFont?: string;
  motionIntensity?: number;
  startFrom?: number;
  sourceDurationInSeconds?: number;
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
      textOverlay: scene.text_overlay,
      durationInFrames,
      words, // per-scene words kept for scene duration calc, not used for captions
      colorPalette: archetype.colorPalette,
      textCardFont: archetype.textCardFont,
      motionIntensity: archetype.motionIntensity,
      startFrom: 0,
      sourceDurationInSeconds: assets.sceneSourceDurations[i] ?? undefined,
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

export function getTotalDurationInFrames(props: CompositionProps): number {
  return props.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
}

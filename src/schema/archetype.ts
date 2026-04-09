import type { TransitionType } from "./director-score.js";

export type ScenePacing = "fast" | "moderate" | "cinematic";

export interface ArchetypeConfig {
  // Pacing tier — controls scene count range and per-scene word budget
  scenePacing: ScenePacing;
  // Rendering fields
  captionStyle:
    | "bold_outline"
    | "color_highlight"
    | "clean"
    | "karaoke_sweep"
    | "gradient_rise"
    | "block_impact"
    | "box_highlight";
  // Per-archetype caption tuning (defaults: chunkSize=5, lingerS=0.3)
  captionChunkSize?: number;
  captionLingerS?: number;
  colorPalette: { background: string; accent: string; text: string };
  textCardFont: string;
  motionIntensity: number;
  // Transition defaults (applied by mapper when CD omits per-scene transition)
  defaultTransition?: TransitionType;
  transitionDurationFrames?: number;
  // Creative/visual fields (used by image prompter)
  artStyle: string;
  lighting: string;
  compositionRules: string;
  culturalMarkers: string;
  mood: string;
  antiArtifactGuidance: string;
  visualColorPalette: string[];
}

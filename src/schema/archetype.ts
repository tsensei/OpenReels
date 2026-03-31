export interface ArchetypeConfig {
  // Rendering fields
  captionStyle: "bold_outline" | "color_highlight" | "clean" | "karaoke_sweep" | "gradient_rise" | "block_impact";
  colorPalette: { background: string; accent: string; text: string };
  textCardFont: string;
  motionIntensity: number;
  // Creative/visual fields (used by image prompter)
  artStyle: string;
  lighting: string;
  compositionRules: string;
  culturalMarkers: string;
  mood: string;
  antiArtifactGuidance: string;
  visualColorPalette: string[];
}

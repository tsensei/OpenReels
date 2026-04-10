import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { ArchetypeConfig } from "../schema/archetype.js";
import type { LLMProvider, LLMUsage } from "../schema/providers.js";

const IMAGE_PROMPT_PATH = path.join(process.cwd(), "prompts", "image-prompter.md");
const VIDEO_PROMPT_PATH = path.join(process.cwd(), "prompts", "video-prompter.md");

const ImagePromptResult = z.object({
  optimized_prompt: z.string(),
});

export interface ImagePromptOutput {
  prompt: string;
  usage: LLMUsage;
}

export interface ImagePromptOptions {
  mode?: "image" | "video";
  rejectionContext?: string;
}

export async function optimizeImagePrompt(
  llm: LLMProvider,
  visualPrompt: string,
  scriptLine: string,
  sceneIndex: number,
  totalScenes: number,
  archetype: ArchetypeConfig,
  opts?: ImagePromptOptions,
): Promise<ImagePromptOutput> {
  const mode = opts?.mode ?? "image";
  const rejectionContext = opts?.rejectionContext;

  let systemPrompt =
    mode === "video"
      ? "You are a motion prompt engineer for AI video generation. Transform scene descriptions into detailed, video-generator-friendly prompts that emphasize temporal motion, camera movement, and dynamic action. Describe what MOVES, how it moves, and how the camera follows. Return the optimized prompt in the optimized_prompt field."
      : "You are a visual prompt engineer for AI image generation. Transform scene descriptions into detailed, image-generator-friendly prompts. Return the optimized prompt in the optimized_prompt field.";

  try {
    systemPrompt = fs.readFileSync(mode === "video" ? VIDEO_PROMPT_PATH : IMAGE_PROMPT_PATH, "utf-8");
  } catch {
    // Use default inline prompt above
  }

  // Inject style bible from archetype's creative fields
  systemPrompt += `

## STYLE BIBLE (all scenes MUST follow this)
Art style: ${archetype.artStyle}
Color palette: ${archetype.visualColorPalette.join(", ")}
Lighting: ${archetype.lighting}
Composition: ${archetype.compositionRules}
Cultural markers: ${archetype.culturalMarkers}
Mood: ${archetype.mood}
Quality guidance: ${archetype.antiArtifactGuidance}`;

  let userMessage = `Scene ${sceneIndex + 1} of ${totalScenes}
Visual description: ${visualPrompt}
Narration: ${scriptLine}`;

  if (rejectionContext) {
    userMessage += `\n\n## CONTEXT FROM STOCK SEARCH\n${rejectionContext}`;
  }

  userMessage +=
    mode === "video"
      ? `\n\nGenerate an optimized video generation prompt for this scene. Focus on motion and camera movement.`
      : `\n\nGenerate an optimized image generation prompt for this scene.`;

  const result = await llm.generate({
    systemPrompt,
    userMessage,
    schema: ImagePromptResult,
  });

  return { prompt: result.data.optimized_prompt, usage: result.usage };
}

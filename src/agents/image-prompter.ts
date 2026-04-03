import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { ArchetypeConfig } from "../schema/archetype.js";
import type { LLMProvider, LLMUsage } from "../schema/providers.js";

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "prompts", "image-prompter.md");

const ImagePromptResult = z.object({
  optimized_prompt: z.string(),
});

export interface ImagePromptOutput {
  prompt: string;
  usage: LLMUsage;
}

export async function optimizeImagePrompt(
  llm: LLMProvider,
  visualPrompt: string,
  scriptLine: string,
  sceneIndex: number,
  totalScenes: number,
  archetype: ArchetypeConfig,
  rejectionContext?: string,
): Promise<ImagePromptOutput> {
  let systemPrompt =
    "You are a visual prompt engineer for AI image generation. Transform scene descriptions into detailed, image-generator-friendly prompts. Return the optimized prompt in the optimized_prompt field.";

  try {
    systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
  } catch {
    // Use default
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

  userMessage += `\n\nGenerate an optimized image generation prompt for this scene.`;

  const result = await llm.generate({
    systemPrompt,
    userMessage,
    schema: ImagePromptResult,
  });

  return { prompt: result.data.optimized_prompt, usage: result.usage };
}

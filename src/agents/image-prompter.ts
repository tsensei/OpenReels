import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import type { ArchetypeConfig } from "../schema/archetype.js";
import { extractUsage, type LLMUsage } from "../schema/providers.js";

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "prompts", "image-prompter.md");

const ImagePromptResult = z.object({
  optimized_prompt: z.string(),
});

export interface ImagePromptOutput {
  prompt: string;
  usage: LLMUsage;
}

export async function optimizeImagePrompt(
  model: LanguageModel,
  visualPrompt: string,
  scriptLine: string,
  sceneIndex: number,
  totalScenes: number,
  archetype: ArchetypeConfig,
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

  const userMessage = `Scene ${sceneIndex + 1} of ${totalScenes}
Visual description: ${visualPrompt}
Narration: ${scriptLine}

Generate an optimized image generation prompt for this scene.`;

  const result = await generateObject({
    model,
    schema: ImagePromptResult,
    system: systemPrompt,
    prompt: userMessage,
  });

  return { prompt: result.object.optimized_prompt, usage: extractUsage(result.usage) };
}

import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { getArchetype } from "../config/archetype-registry.js";
import { loadPlaybookSections } from "../config/playbook.js";
import type { DirectorScore } from "../schema/director-score.js";
import type { ScenePacing } from "../schema/archetype.js";
import type { LLMProvider, LLMUsage } from "../schema/providers.js";

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "prompts", "critic.md");

const CritiqueResult = z.object({
  score: z.number(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  revision_needed: z.boolean(),
  revision_instructions: z.string().nullable(),
  weakest_scene_index: z.number().nullable(),
});
export type CritiqueResult = z.infer<typeof CritiqueResult>;

export interface CritiqueOutput {
  data: CritiqueResult;
  usage: LLMUsage;
}

export async function evaluate(
  llm: LLMProvider,
  score: DirectorScore,
  topic: string,
  pacingOverride?: string,
): Promise<CritiqueOutput> {
  let systemPrompt =
    "You are a video quality critic. Evaluate the DirectorScore for hook strength, visual variety, pacing, script quality, and overall coherence. Score 1-10. If below 7, provide specific revision instructions targeting the weakest scene.";

  try {
    systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
  } catch {
    // Use default
  }

  // Inject Critic Rubric from playbook for weighted scoring criteria
  try {
    const rubric = loadPlaybookSections(["Pacing Rules", "Critic Rubric"]);
    systemPrompt += "\n\n" + rubric;
  } catch (err) {
    console.warn(`[critic] Playbook rubric not loaded: ${err}`);
  }

  // Derive pacing tier: explicit override > archetype config lookup
  let pacingTier: ScenePacing = "moderate";
  if (pacingOverride && ["fast", "moderate", "cinematic"].includes(pacingOverride)) {
    pacingTier = pacingOverride as ScenePacing;
  } else {
    try {
      pacingTier = getArchetype(score.archetype).scenePacing;
    } catch {
      // Unknown archetype — default to moderate
    }
  }

  const PACING_RANGES: Record<ScenePacing, string> = {
    fast: "8-12 scenes, 8-12 words per scene, 90-120 total words",
    moderate: "7-10 scenes, 10-16 words per scene, 100-140 total words",
    cinematic: "5-8 scenes, 15-22 words per scene, 90-130 total words",
  };

  const userMessage = `Topic: ${topic}

This video uses **${pacingTier}** pacing (${PACING_RANGES[pacingTier]}).
Evaluate pacing against these tier-specific thresholds, NOT a fixed "5-7 scenes" standard.

DirectorScore:
${JSON.stringify(score, null, 2)}

Evaluate this video plan. Score it 1-10. If it scores below 7, identify the weakest scene and provide specific revision instructions.`;

  const result = await llm.generate({
    systemPrompt,
    userMessage,
    schema: CritiqueResult,
  });
  return { data: result.data, usage: result.usage };
}

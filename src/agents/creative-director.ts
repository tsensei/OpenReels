import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import type { LLMProvider, LLMUsage } from "../schema/providers.js";
import { DirectorScore, VisualType, Motion } from "../schema/director-score.js";
import { listArchetypes } from "../config/archetype-registry.js";
import { loadPlaybook } from "../config/playbook.js";
import type { ResearchResult } from "./research.js";

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "prompts", "creative-director.md");

// Schema for LLM output (before refinements that can't be expressed in JSON Schema)
const DirectorScoreRaw = z.object({
  emotional_arc: z.string(),
  archetype: z.enum(listArchetypes() as [string, ...string[]]),
  music_mood: z.string(),
  scenes: z.array(
    z.object({
      visual_type: VisualType,
      visual_prompt: z.string(),
      motion: Motion,
      script_line: z.string(),
    }),
  ),
});

export interface DirectorScoreOutput {
  data: DirectorScore;
  usage: LLMUsage;
}

export async function generateDirectorScore(
  llm: LLMProvider,
  topic: string,
  researchContext: ResearchResult,
  options?: { archetype?: string },
): Promise<DirectorScoreOutput> {
  let systemPrompt = buildDefaultPrompt();

  try {
    systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
  } catch {
    // Use default
  }

  // Inject full playbook for content strategy guidance
  try {
    const playbook = loadPlaybook();
    systemPrompt += "\n\n## Reference: Content Playbook\n\n" + playbook;
  } catch (err) {
    console.warn(`[creative-director] Playbook not loaded: ${err}`);
  }

  const archetypes = listArchetypes();
  const archetypeInstruction = options?.archetype
    ? `Use the "${options.archetype}" archetype.`
    : `Choose from: ${archetypes.join(", ")}`;

  const userMessage = `Topic: ${topic}

Research context:
${researchContext.summary}

Key facts:
${researchContext.key_facts.map((f) => `- ${f}`).join("\n")}

Mood: ${researchContext.mood}

${archetypeInstruction}

Create a DirectorScore with 4-7 scenes. Use all 4 visual types (ai_image, stock_image, stock_video, text_card).
CRITICAL RULE: Never use the same visual_type more than 2 times in a row.
Every scene MUST have a script_line (the voiceover text).
The first scene should be a strong hook.
PACING CONSTRAINT: Total script must be 110-140 words for stories, 90-110 for quick facts. At 150 WPM this produces a 40-55 second video. Each script_line should be 1-2 sentences. If over budget, cut a scene rather than cramming.`;

  const maxRetries = 3;
  let lastError: Error | null = null;
  const totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0 };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await llm.generate({
        systemPrompt,
        userMessage: attempt > 0
          ? `${userMessage}\n\nPREVIOUS ATTEMPT FAILED: ${lastError?.message}. Fix the issue.`
          : userMessage,
        schema: DirectorScoreRaw,
      });

      totalUsage.inputTokens += result.usage.inputTokens;
      totalUsage.outputTokens += result.usage.outputTokens;

      // Validate with full DirectorScore (includes refinements like golden rule)
      const validated = DirectorScore.parse(result.data);
      return { data: validated, usage: totalUsage };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[creative-director] Attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }

  throw new Error(`Creative Director failed after ${maxRetries} attempts: ${lastError?.message}`);
}

function buildDefaultPrompt(): string {
  return `You are a Creative Director for short-form video content. Your job is to create a detailed per-scene production plan (DirectorScore) that will drive the entire video creation pipeline.

You must output a DirectorScore with:
- emotional_arc: A journey descriptor (e.g., "curiosity-to-wisdom", "shock-to-understanding")
- archetype: Visual style that drives transitions, colors, and captions
- music_mood: Tag for background music selection (e.g., "epic_cinematic", "chill_lofi", "tense_electronic")
- scenes: Array of 4-7 scenes, each with visual_type, visual_prompt, motion, and script_line

GOLDEN RULE: Never use the same visual_type more than 2 times consecutively. Mix ai_image, stock_image, stock_video, and text_card for variety.

Think like a YouTube Shorts producer. The hook must grab in 1-2 seconds. Every scene should move the story forward. End with a memorable line.

Keep total script under 140 words — verbose scripts create rushed, unwatchable videos.`;
}

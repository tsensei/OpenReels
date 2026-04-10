import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { getArchetype, listArchetypes } from "../config/archetype-registry.js";
import type { ScenePacing } from "../schema/archetype.js";
import { loadPlaybook } from "../config/playbook.js";
import { DirectorScore, Motion, MusicMood, TransitionType, VisualType } from "../schema/director-score.js";
import type { LLMProvider, LLMUsage } from "../schema/providers.js";
import type { ResearchResult } from "./research.js";
import type { CritiqueResult } from "./critic.js";

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "prompts", "creative-director.md");

// Schema for LLM generation output. Intentionally omits min/max on the scenes
// array because Gemini's structured-output API rejects minItems > 1 in JSON
// Schema. Scene count is guided by pacing instructions in the prompt, then
// enforced by DirectorScore.parse() (which keeps .min(3).max(16)).
const DirectorScoreRaw = z.object({
  emotional_arc: z.string(),
  archetype: z.enum(listArchetypes() as [string, ...string[]]),
  music_mood: MusicMood,
  scenes: z.array(
    z.object({
      visual_type: VisualType,
      visual_prompt: z.string(),
      motion: Motion,
      script_line: z.string(),
      transition: TransitionType.nullable(),
    }),
  ),
});

export interface DirectorScoreOutput {
  data: DirectorScore;
  usage: LLMUsage;
}

/** Load the creative director system prompt with playbook injection */
function loadDirectorSystemPrompt(): string {
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

  return systemPrompt;
}

export async function generateDirectorScore(
  llm: LLMProvider,
  topic: string,
  researchContext: ResearchResult,
  options?: { archetype?: string; pacing?: string; videoEnabled?: boolean; direction?: string },
): Promise<DirectorScoreOutput> {
  const systemPrompt = loadDirectorSystemPrompt();

  const archetypes = listArchetypes();
  const archetypeInstruction = options?.archetype
    ? `Use the "${options.archetype}" archetype.`
    : `Choose from: ${archetypes.join(", ")}`;

  const videoEnabled = options?.videoEnabled ?? false;
  const visualTypes = videoEnabled
    ? "all 5 visual types (ai_image, ai_video, stock_image, stock_video, text_card)"
    : "all 4 visual types (ai_image, stock_image, stock_video, text_card)";
  const videoGuidance = videoEnabled
    ? "\nai_video: Use for 1-3 scenes where MOTION is the story (explosions, flowing water, launches, transformations). ai_video costs ~$0.30/scene vs ~$0.04 for ai_image. Use selectively. Set motion to 'static' for ai_video scenes (the video model handles motion)."
    : "";

  // Resolve pacing tier: explicit --pacing override > archetype default > lookup table
  const pacingInstruction = buildPacingInstruction(options?.archetype, options?.pacing);

  const directionSection = options?.direction?.trim()
    ? `\n## Creative Direction (from the producer)\n\n${options.direction}\n\nHonor these creative constraints while exercising your judgment on anything not specified.\n`
    : "";

  const userMessage = `Topic: ${topic}

Research context:
${researchContext.summary}

Key facts:
${researchContext.key_facts.map((f) => `- ${f}`).join("\n")}

Mood: ${researchContext.mood}

${archetypeInstruction}

${pacingInstruction}
Use ${visualTypes}.${videoGuidance}
${directionSection}CRITICAL RULE: Never use the same visual_type more than 2 times in a row. With more scenes, plan your visual_type sequence BEFORE writing scenes to ensure variety.
Every scene MUST have a script_line (the voiceover text).
The first scene should be a strong hook.
If over budget, cut a scene rather than cramming.`;

  const maxRetries = 3;
  let lastError: Error | null = null;
  const totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0 };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await llm.generate({
        systemPrompt,
        userMessage:
          attempt > 0
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
- music_mood: MUST be exactly one of: "epic_cinematic", "tense_electronic", "chill_lofi", "uplifting_pop", "mysterious_ambient", "warm_acoustic", "dark_cinematic", "dreamy_ethereal"
- scenes: Array of scenes following the archetype's recommended pacing tier

GOLDEN RULE: Never use the same visual_type more than 2 times consecutively. Mix ai_image, stock_image, stock_video, and text_card for variety.

Think like a YouTube Shorts producer. The hook must grab in 1-2 seconds. Every scene should move the story forward. The FINAL scene MUST be a call-to-action (e.g. "What would you have done? Comment below."), not a story conclusion.

Keep total script under 140 words — verbose scripts create rushed, unwatchable videos.`;
}

// --- Pacing tier configuration ---

const PACING_CONFIG: Record<ScenePacing, { min: number; max: number; wordsPerScene: string; totalWords: string }> = {
  fast: { min: 8, max: 12, wordsPerScene: "8-12", totalWords: "90-120" },
  moderate: { min: 7, max: 10, wordsPerScene: "10-16", totalWords: "100-140" },
  cinematic: { min: 5, max: 8, wordsPerScene: "15-22", totalWords: "90-130" },
};

const PACING_TIER_TABLE = `After choosing your archetype, use the matching pacing tier from this table:
- fast (8-12 scenes, 8-12 words/scene, 90-120 words total): infographic, bold_illustration, comic_book
- moderate (7-10 scenes, 10-16 words/scene, 100-140 words total): warm_editorial, editorial_caricature, anime_illustration, vintage_snapshot, surreal_dreamscape, gothic_fantasy
- cinematic (5-8 scenes, 15-22 words/scene, 90-130 words total): cinematic_documentary, moody_cinematic, studio_realism, warm_narrative, pastoral_watercolor`;

export function buildPacingInstruction(archetype?: string, pacingOverride?: string): string {
  // Path 1: Explicit --pacing override always wins
  if (pacingOverride && pacingOverride in PACING_CONFIG) {
    const tier = pacingOverride as ScenePacing;
    const cfg = PACING_CONFIG[tier];
    console.log(`[creative-director] Using ${tier} pacing (${cfg.min}-${cfg.max} scenes) — explicit override`);
    return `Use ${tier} pacing. Create a DirectorScore with ${cfg.min}-${cfg.max} scenes.
Per-scene word budget: ${cfg.wordsPerScene} words. Total word budget: ${cfg.totalWords} words.`;
  }

  // Path 2: Archetype specified — derive tier from config
  if (archetype) {
    try {
      const config = getArchetype(archetype);
      const tier = config.scenePacing;
      const cfg = PACING_CONFIG[tier];
      console.log(`[creative-director] Using ${tier} pacing (${cfg.min}-${cfg.max} scenes) for archetype ${archetype}`);
      return `This archetype uses ${tier} pacing. Create a DirectorScore with ${cfg.min}-${cfg.max} scenes.
Per-scene word budget: ${cfg.wordsPerScene} words. Total word budget: ${cfg.totalWords} words.`;
    } catch {
      // Unknown archetype — fall through to table
    }
  }

  // Path 3: No archetype specified — LLM picks, include full tier table
  console.log("[creative-director] No archetype specified — injecting pacing tier lookup table");
  return PACING_TIER_TABLE;
}

export { PACING_CONFIG };

// ── Revision ─────────────────────────────────────────────────────────────────

export async function reviseDirectorScore(
  llm: LLMProvider,
  topic: string,
  researchContext: ResearchResult,
  originalScore: DirectorScore,
  critique: CritiqueResult,
  options?: { archetype?: string; pacing?: string; videoEnabled?: boolean; direction?: string },
): Promise<DirectorScoreOutput> {
  const systemPrompt = loadDirectorSystemPrompt();

  // Build revision instructions from critique, guarding nullable revision_instructions
  const revisionGuidance = critique.revision_instructions
    ?? `Address these weaknesses: ${critique.weaknesses.join("; ")}`;

  const pacingInstruction = buildPacingInstruction(options?.archetype, options?.pacing);

  const videoEnabled = options?.videoEnabled ?? false;
  const visualTypes = videoEnabled
    ? "all 5 visual types (ai_image, ai_video, stock_image, stock_video, text_card)"
    : "all 4 visual types (ai_image, stock_image, stock_video, text_card)";

  const directionSection = options?.direction?.trim()
    ? `\n## Creative Direction (from the producer)\n\n${options.direction}\n\nHonor these creative constraints while exercising your judgment on anything not specified.\n`
    : "";

  const userMessage = `Topic: ${topic}

Research context:
${researchContext.summary}

Key facts:
${researchContext.key_facts.map((f) => `- ${f}`).join("\n")}

Mood: ${researchContext.mood}

${pacingInstruction}
Use ${visualTypes}.
${directionSection}
## Current Plan (score: ${critique.score}/10)

${JSON.stringify(originalScore, null, 2)}

## Critic Feedback

Strengths: ${critique.strengths.join(", ")}
Weaknesses: ${critique.weaknesses.join(", ")}
${critique.weakest_scene_index != null ? `Weakest scene: Scene ${critique.weakest_scene_index}` : ""}

## Revision Instructions

${revisionGuidance}

Revise the DirectorScore to address the weaknesses while preserving the strengths.
Keep the same archetype. Maintain the GOLDEN RULE: never use the same visual_type more than 2 times in a row.`;

  const maxRetries = 2;
  let lastError: Error | null = null;
  const totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0 };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await llm.generate({
        systemPrompt,
        userMessage:
          attempt > 0
            ? `${userMessage}\n\nPREVIOUS ATTEMPT FAILED: ${lastError?.message}. Fix the issue.`
            : userMessage,
        schema: DirectorScoreRaw,
      });

      totalUsage.inputTokens += result.usage.inputTokens;
      totalUsage.outputTokens += result.usage.outputTokens;

      const validated = DirectorScore.parse(result.data);

      // Prevent archetype drift: the LLM may change the archetype during revision
      // despite prompt instructions. Force it back to the original.
      if (validated.archetype !== originalScore.archetype) {
        (validated as { archetype: string }).archetype = originalScore.archetype;
      }

      return { data: validated, usage: totalUsage };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[creative-director] Revision attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }

  throw new Error(`Revision failed after ${maxRetries} attempts: ${lastError?.message}`);
}

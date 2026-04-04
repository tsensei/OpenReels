import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { MusicMood } from "../schema/director-score.js";
import type { LLMProvider, LLMUsage } from "../schema/providers.js";

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "prompts", "music-prompter.md");

const MusicPromptResult = z.object({
  music_prompt: z.string(),
});

export interface MusicPromptInput {
  musicMood: MusicMood;
  emotionalArc: string;
  archetype: string;
  archetypeMood: string;
  sceneDurations: number[];
  sceneNarratives: string[];
  totalDurationSeconds: number;
}

export interface MusicPromptOutput {
  prompt: string;
  usage: LLMUsage;
}

/**
 * LLM agent that generates rich Lyria 3 Pro prompts from DirectorScore fields.
 * Follows the image-prompter.ts pattern.
 *
 * Receives per-scene script_lines for emotional context (which scene is the climax,
 * which is the quiet resolution). The system prompt instructs the LLM to translate
 * narrative emotion into musical direction only — never output topic/content words
 * in the Lyria prompt. Lyria's own safety filter provides a second layer of defense.
 */
export async function generateMusicPrompt(
  llm: LLMProvider,
  input: MusicPromptInput,
): Promise<MusicPromptOutput> {
  let systemPrompt =
    "You are a film underscore composer writing musical direction for Google Lyria 3 Pro, an AI music generation model. " +
    "You describe SOUND — never subject matter. Your output is a detailed text prompt that Lyria will use to generate background music. " +
    "Return the complete music generation prompt in the music_prompt field.";

  try {
    systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
  } catch {
    // Use default
  }

  // Compute timestamp sections from scene durations + narratives
  const sections: string[] = [];
  let cursor = 0;
  for (let i = 0; i < input.sceneDurations.length; i++) {
    const dur = input.sceneDurations[i]!;
    const start = formatTimestamp(cursor);
    const end = formatTimestamp(cursor + dur);
    const narrative = input.sceneNarratives[i] ?? "";
    const narrativeSuffix = narrative ? ` — "${narrative}"` : "";
    sections.push(`Scene ${i + 1}: [${start} - ${end}] (${dur.toFixed(1)}s)${narrativeSuffix}`);
    cursor += dur;
  }

  const userMessage = `Generate a background music prompt for Lyria 3 Pro.

## Musical Direction
- Music mood: ${input.musicMood}
- Emotional arc: ${input.emotionalArc}
- Archetype: ${input.archetype}
- Archetype mood: ${input.archetypeMood}
- Total duration: ${input.totalDurationSeconds} seconds (request exactly this)

## Scene Timing and Narrative Context
${sections.join("\n")}

Use the narrative text to understand each scene's emotional weight — which scene is the climax, which is quiet reflection, which builds tension. Translate that emotion into musical direction (intensity, instrumentation, dynamics). NEVER include topic words, character names, or event descriptions in the output prompt.

Generate a detailed Lyria prompt with:
1. Genre, style, and production approach
2. Specific instruments with descriptors
3. Tempo (BPM or descriptive)
4. Timestamp sections [M:SS - M:SS] matching the scene timing above, each with intensity and instrumentation
5. Critical constraints: purely instrumental, no vocals, background level, exact duration

The prompt must describe SOUND ONLY — never reference the video topic, characters, or events.`;

  const result = await llm.generate({
    systemPrompt,
    userMessage,
    schema: MusicPromptResult,
  });

  const prompt = result.data.music_prompt;
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Music prompter returned empty prompt");
  }

  return { prompt, usage: result.usage };
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

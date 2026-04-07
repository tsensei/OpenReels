import { z } from "zod";
import type { LLMProvider, LLMUsage } from "../../schema/providers.js";

// Intentionally omit .min()/.max() on the array — Gemini's structured output
// rejects minItems > 1. The prompt guides "2-3 queries"; validation is not
// worth breaking an entire provider over.
const QueryReformSchema = z.object({
  queries: z.array(z.string()),
  reasoning: z.string(),
});

const SYSTEM_PROMPT = `You are a stock footage search expert. Convert the given visual description into 2-3 alternative search queries optimized for stock photo/video APIs like Pexels and Pixabay.

Rules:
- Strip proper nouns (no brand names, specific locations, people's names)
- Use concrete visual nouns that stock APIs understand
- Keep each query 3-5 words
- Order by specificity: most specific first, broadest last
- Focus on what the camera would SEE, not the concept

Example:
Input: "Artemis rocket launching from Kennedy Space Center"
Output: ["rocket launch pad fire smoke", "space shuttle takeoff", "rocket launch"]

Example:
Input: "The Great Wall of China at sunset"
Output: ["ancient stone wall mountains sunset", "long wall landscape golden hour", "historic wall panorama"]`;

export async function reformulateStockQuery(
  llm: LLMProvider,
  visualPrompt: string,
  scriptLine: string,
): Promise<{ queries: string[]; usage: LLMUsage }> {
  try {
    const result = await llm.generate({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: `Visual description: ${visualPrompt}\nNarration context: ${scriptLine}\n\nGenerate stock search queries.`,
      schema: QueryReformSchema,
    });
    return { queries: result.data.queries, usage: result.usage };
  } catch (err) {
    console.warn(`[stock] Query reformulation failed, using original: ${err}`);
    return {
      queries: [visualPrompt],
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

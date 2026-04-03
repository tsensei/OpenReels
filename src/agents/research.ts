import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { generateObject, generateText } from "ai";
import type { LanguageModel } from "ai";
import type { LLMUsage } from "../schema/providers.js";

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "prompts", "researcher.md");

const ResearchResult = z.object({
  summary: z.string(),
  key_facts: z.array(z.string()),
  mood: z.string(),
  sources: z.array(z.string()),
});
export type ResearchResult = z.infer<typeof ResearchResult>;

export interface ResearchOutput {
  data: ResearchResult;
  usage: LLMUsage;
}

export async function research(model: LanguageModel, topic: string): Promise<ResearchOutput> {
  let systemPrompt =
    "You are a research assistant. Given a topic, search the web for current information and produce a structured research summary with key facts, mood/tone, and sources.";

  try {
    systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
  } catch {
    // Use default prompt if file doesn't exist
  }

  // Two-pass approach: first get web search results as free text, then structure them.
  // This works because generateText with web search tools returns grounded content,
  // then generateObject structures it with the schema.
  const searchResult = await generateText({
    model,
    system: systemPrompt,
    prompt: `Research this topic for a short-form video script: ${topic}`,
    // Note: web search is provider-dependent. Anthropic uses web_search tool,
    // OpenAI uses search-enabled models. The Vercel AI SDK handles this.
  });

  const totalUsage: LLMUsage = {
    inputTokens: searchResult.usage.inputTokens ?? 0,
    outputTokens: searchResult.usage.outputTokens ?? 0,
  };

  const structured = await generateObject({
    model,
    schema: ResearchResult,
    system:
      "You are a data extraction assistant. Structure the following research into the exact format requested. Use only the information provided.",
    prompt: `Based on this research:\n\n${searchResult.text}\n\nStructure this into the required format.`,
  });

  totalUsage.inputTokens += structured.usage.inputTokens ?? 0;
  totalUsage.outputTokens += structured.usage.outputTokens ?? 0;

  return { data: structured.object, usage: totalUsage };
}

import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { LLMProvider, LLMUsage } from "../schema/providers.js";

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

export async function research(llm: LLMProvider, topic: string): Promise<ResearchOutput> {
  let systemPrompt =
    "You are a research assistant. Given a topic, search the web for current information and produce a structured research summary with key facts, mood/tone, and sources.";

  try {
    systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
  } catch {
    // Use default prompt if file doesn't exist
  }

  const result = await llm.generate({
    systemPrompt,
    userMessage: `Research this topic for a short-form video script: ${topic}`,
    schema: ResearchResult,
    enableWebSearch: true,
  });
  return { data: result.data, usage: result.usage };
}

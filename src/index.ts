#!/usr/bin/env node

import * as readline from "node:readline";
import { parseArgs } from "./cli/args.js";
import { validateEnv } from "./cli/validate-env.js";
import { createCliCallbacks, runPipeline } from "./pipeline/orchestrator.js";
import { createProviders } from "./providers/factory.js";
import type { LLMProvider } from "./schema/providers.js";
import type { ResearchResult } from "./agents/research.js";

async function main(): Promise<void> {
  const opts = parseArgs();

  // Validate required API keys (and local tool availability) before constructing providers.
  // When --ollama-model / --ollama-image-model are omitted, validateEnv presents an interactive
  // model selection prompt and returns the chosen values in envResult.
  const envResult = await validateEnv({
    provider: opts.provider,
    ttsProvider: opts.ttsProvider,
    imageProvider: opts.imageProvider,
    ollamaHost: opts.ollamaHost,
    ollamaModel: opts.ollamaModel,
    ollamaImageModel: opts.ollamaImageModel,
  });

  // Use model names resolved by validateEnv (interactive selection or explicit flag)
  const resolvedOllamaModel = envResult.ollamaModel ?? opts.ollamaModel;
  const resolvedOllamaImageModel = envResult.ollamaImageModel ?? opts.ollamaImageModel;

  // Initialize all providers via factory
  const { llm, tts, imageGen, stock } = createProviders({
    llm: opts.provider,
    tts: opts.ttsProvider,
    image: opts.imageProvider,
    ollamaModel: resolvedOllamaModel,
    ollamaImageModel: resolvedOllamaImageModel,
    ollamaHost: opts.ollamaHost,
    chatterboxDevice: opts.chatterboxDevice,
    chatterboxAudioPrompt: opts.chatterboxAudioPrompt,
    chatterboxPythonBin: envResult.chatterboxPythonBin,
  });

  // Collect topic brief for Ollama mode (replaces web-search research)
  let topicBrief: ResearchResult | undefined;
  if (opts.provider === "ollama") {
    topicBrief = await collectTopicBrief(opts.topic, llm, opts.brief);
  }

  // Build CLI callbacks (wraps ProgressDisplay + cost/log printing)
  const { callbacks } = createCliCallbacks(opts.yes);

  // Run pipeline
  const result = await runPipeline(
    {
      topic: opts.topic,
      llm,
      tts,
      ttsProvider: opts.ttsProvider,
      imageGen,
      imageProvider: opts.imageProvider,
      stock,
      archetype: opts.archetype,
      platform: opts.platform,
      dryRun: opts.dryRun,
      preview: opts.preview,
      outputDir: opts.output,
      yes: opts.yes,
      topicBrief,
    },
    callbacks,
  );

  if (result.videoPath) {
    console.log(`\nDone! Video saved to: ${result.videoPath}`);
  } else if (opts.dryRun) {
    console.log(`\nDry run complete. DirectorScore saved to: ${result.scorePath}`);
  }
}

/**
 * Collects topic context for Ollama mode.
 *
 * Flow:
 *   1. --brief flag → use it directly, no prompts
 *   2. Non-TTY (Docker/pipe) → continue with topic only
 *   3. Interactive TTY →
 *      a. Explain why context helps
 *      b. Offer: [1] AI-guided questions (Ollama generates 3 topic-specific questions)
 *                [2] Write it yourself (freeform)
 *                [3] Skip (topic name only)
 */
async function collectTopicBrief(
  topic: string,
  llm: LLMProvider,
  brief?: string,
): Promise<ResearchResult> {
  if (brief) {
    console.info(`\n  Using provided --brief for research context.\n`);
    return { summary: brief, key_facts: [], mood: "neutral", sources: [] };
  }

  if (!process.stdin.isTTY) {
    return { summary: `Topic: ${topic}`, key_facts: [], mood: "neutral", sources: [] };
  }

  const divider = `─────────────────────────────────────────────────────────────`;

  console.info(
    `\n${divider}\n` +
    ` Topic context — optional but recommended\n` +
    `${divider}\n\n` +
    ` Since you're using Ollama (no web search), providing a little context\n` +
    ` helps us write a more accurate and interesting script for you.\n\n` +
    ` How would you like to provide context?\n\n` +
    `  [1]  Guided   — We ask you 3 questions about "${topic}"\n` +
    `  [2]  Freeform — You write a few lines yourself\n` +
    `  [3]  Skip     — Continue with topic name only\n`,
  );

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

  let choice = "";
  while (!["1", "2", "3"].includes(choice)) {
    choice = await ask(`  Your choice (1/2/3): `);
    if (!["1", "2", "3"].includes(choice)) {
      console.info(`  Please enter 1, 2, or 3.`);
    }
  }

  // ── Option 3: skip ──────────────────────────────────────────────────────────
  if (choice === "3") {
    rl.close();
    console.info(`\n  Continuing with topic name only.\n`);
    return { summary: `Topic: ${topic}`, key_facts: [], mood: "neutral", sources: [] };
  }

  // ── Option 2: freeform ──────────────────────────────────────────────────────
  if (choice === "2") {
    console.info(
      `\n  Write a few lines about your topic — key facts, context, desired mood.\n`
    );
    const text = await ask(`  > `);
    rl.close();
    console.info("");
    return {
      summary: text || `Topic: ${topic}`,
      key_facts: [],
      mood: "neutral",
      sources: [],
    };
  }

  // ── Option 1: AI-guided questions ───────────────────────────────────────────
  console.info(`\n  Generating questions for "${topic}"...\n`);

  let questions: string[] = [];
  try {
    const { z } = await import("zod");
    const QuestionsSchema = z.object({
      questions: z.array(z.string()).length(3),
    });
    const result = await llm.generate({
      systemPrompt:
        `You are a research assistant helping prepare a short-form video script.\n` +
        `Generate exactly 3 specific, open-ended questions that will help gather useful\n` +
        `context about the given topic. Questions should target: key facts/events,\n` +
        `emotional angle or human interest, and surprising or lesser-known details.\n` +
        `Keep each question under 15 words.`,
      userMessage: `Topic: "${topic}"`,
      schema: QuestionsSchema,
    });
    questions = result.data.questions;
  } catch {
    questions = [
      `What are the most important facts about "${topic}"?`,
      `What is the emotional angle or human story here?`,
      `What would surprise most people about this topic?`,
    ];
  }

  console.info(`  Answer each question (or press Enter to skip):\n`);

  const answers: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    console.info(`  ${i + 1}. ${questions[i]}`);
    const answer = await ask(`     > `);
    answers.push(answer);
    console.info("");
  }

  rl.close();

  const key_facts = answers.filter(Boolean);
  const summary = key_facts.length > 0
    ? key_facts.join(". ")
    : `Topic: ${topic}`;

  return { summary, key_facts, mood: "neutral", sources: [] };
}

main().catch((err) => {
  console.error("\nPipeline failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

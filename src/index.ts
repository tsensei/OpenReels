#!/usr/bin/env node

import { parseArgs } from "./cli/args.js";
import { runPipeline } from "./pipeline/orchestrator.js";
import { AnthropicLLM } from "./providers/llm/anthropic.js";
import { OpenAILLM } from "./providers/llm/openai.js";
import { ElevenLabsTTS } from "./providers/tts/elevenlabs.js";
import { GeminiImage } from "./providers/image/gemini.js";
import { OpenAIImage } from "./providers/image/openai.js";
import { PexelsStock } from "./providers/stock/pexels.js";
import type { LLMProvider } from "./schema/providers.js";

async function main(): Promise<void> {
  const opts = parseArgs();

  // Initialize providers
  const llm: LLMProvider =
    opts.provider === "openai" ? new OpenAILLM() : new AnthropicLLM();

  const tts = new ElevenLabsTTS();
  const imageGen = opts.imageProvider === "openai" ? new OpenAIImage() : new GeminiImage();
  const stock = new PexelsStock();

  // Run pipeline
  const result = await runPipeline({
    topic: opts.topic,
    llm,
    tts,
    imageGen,
    imageProvider: opts.imageProvider,
    stock,
    archetype: opts.archetype,
    platform: opts.platform,
    dryRun: opts.dryRun,
    preview: opts.preview,
    outputDir: opts.output,
  });

  if (result.videoPath) {
    console.log(`\nDone! Video saved to: ${result.videoPath}`);
  } else if (opts.dryRun) {
    console.log(`\nDry run complete. DirectorScore saved to: ${result.scorePath}`);
  }
}

main().catch((err) => {
  console.error("\nPipeline failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

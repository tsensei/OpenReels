#!/usr/bin/env node

import { parseArgs } from "./cli/args.js";
import { validateEnv } from "./cli/validate-env.js";
import { createCliCallbacks } from "./pipeline/cli-utils.js";
import { runPipeline, STAGE_NAMES } from "./pipeline/orchestrator.js";
import { createProviders } from "./providers/factory.js";

async function main(): Promise<void> {
  const opts = parseArgs();

  // Validate required API keys before constructing providers
  validateEnv({
    provider: opts.provider,
    ttsProvider: opts.ttsProvider,
    imageProvider: opts.imageProvider,
  });

  // Initialize providers via factory (model is now a Vercel AI SDK LanguageModel)
  const { model, tts, imageGen, stock } = createProviders({
    llm: opts.provider,
    tts: opts.ttsProvider,
    image: opts.imageProvider,
  });

  // Create CLI callbacks for terminal progress display
  const { callbacks, progress } = createCliCallbacks(opts.yes, STAGE_NAMES);

  // Run pipeline with CLI callbacks
  const result = await runPipeline(
    {
      topic: opts.topic,
      model,
      llmProvider: opts.provider,
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
      noMusic: opts.noMusic,
    },
    callbacks,
  );

  progress.summary();

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

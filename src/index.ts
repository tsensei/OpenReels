#!/usr/bin/env node

import { parseArgs } from "./cli/args.js";
import { validateEnv } from "./cli/validate-env.js";
import { createCliCallbacks, runPipeline } from "./pipeline/orchestrator.js";
import { createProviders } from "./providers/factory.js";

async function main(): Promise<void> {
  const opts = parseArgs();

  // Validate required API keys before constructing providers
  validateEnv({
    provider: opts.provider,
    ttsProvider: opts.ttsProvider,
    imageProvider: opts.imageProvider,
  });

  // Initialize providers via factory
  const { llm, tts, imageGen, stock } = createProviders({
    llm: opts.provider,
    tts: opts.ttsProvider,
    image: opts.imageProvider,
  });

  // Create CLI callbacks for terminal progress display
  const { callbacks, progress } = createCliCallbacks(opts.yes);

  // Run pipeline with CLI callbacks
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

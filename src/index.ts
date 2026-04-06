#!/usr/bin/env node

import { parseArgs } from "./cli/args.js";
import { validateEnv } from "./cli/validate-env.js";
import { createCliCallbacks, runPipeline } from "./pipeline/orchestrator.js";
import { createProviders, createVerificationModel } from "./providers/factory.js";
import { checkOllamaHealth } from "./providers/llm/ollama-health.js";

async function main(): Promise<void> {
  const opts = parseArgs();

  // Validate required API keys before constructing providers
  validateEnv({
    provider: opts.provider,
    ttsProvider: opts.ttsProvider,
    imageProvider: opts.imageProvider,
    videoProvider: opts.videoProvider,
    musicProvider: opts.musicProvider,
    localMode: opts.localMode,
  });

  // Validate Ollama connectivity if using local/ollama provider
  if (opts.provider === "ollama") {
    try {
      await checkOllamaHealth(opts.ollamaBaseUrl, opts.ollamaModel);
    } catch (err) {
      console.error(`\n${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    }
  }

  // Initialize providers via factory
  const { llm, tts, imageGen, stock, videoProviders, music } = createProviders({
    llm: opts.provider,
    tts: opts.ttsProvider,
    image: opts.imageProvider,
    video: opts.videoProvider,
    videoModel: opts.videoModel,
    music: opts.musicProvider,
    kokoroVoice: opts.kokoroVoice,
    ollamaModel: opts.ollamaModel,
    ollamaBaseUrl: opts.ollamaBaseUrl,
    localMode: opts.localMode,
  });

  // Create CLI callbacks for terminal progress display
  const { callbacks, progress } = createCliCallbacks(opts.yes);

  // Create verification model for stock footage VLM check
  const verifyModel = opts.stockVerify
    ? createVerificationModel(opts.provider, opts.verificationModel)
    : undefined;

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
      pacing: opts.pacing,
      platform: opts.platform,
      dryRun: opts.dryRun,
      preview: opts.preview,
      outputDir: opts.output,
      yes: opts.yes,
      noMusic: opts.noMusic,
      musicProvider: music,
      musicProviderKey: opts.musicProvider,
      videoProviders: opts.noVideo ? [] : videoProviders,
      videoProvider: opts.videoProvider,
      noVideo: opts.noVideo,
      localMode: opts.localMode,
      stockVerify: opts.stockVerify,
      stockConfidence: opts.stockConfidence,
      stockMaxAttempts: opts.stockMaxAttempts,
      verifyModel,
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

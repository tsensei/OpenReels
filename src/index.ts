#!/usr/bin/env node

import * as fs from "node:fs";
import { parseArgs } from "./cli/args.js";
import { showUsageReport } from "./cli/usage-report.js";
import { validateEnv } from "./cli/validate-env.js";
import { createCliCallbacks, runPipeline } from "./pipeline/orchestrator.js";
import { createProviders, createVerificationModel } from "./providers/factory.js";
import { DirectorScore } from "./schema/director-score.js";

async function main(): Promise<void> {
  const opts = parseArgs();

  // --usage: show cost report and exit
  if (opts.usage) {
    showUsageReport(opts.output);
    return;
  }

  // Load direction file if provided
  let direction: string | undefined;
  if (opts.direction) {
    try {
      const stat = fs.statSync(opts.direction);
      if (stat.size > 10240) {
        console.error(`Direction file exceeds 10KB limit (${stat.size} bytes): ${opts.direction}`);
        process.exit(1);
      }
      const content = fs.readFileSync(opts.direction, "utf-8");
      // Check for binary content (null bytes)
      if (content.includes("\0")) {
        console.error(`Direction file appears to be binary, expected a text file: ${opts.direction}`);
        process.exit(1);
      }
      if (content.trim()) {
        direction = content;
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(`Direction file not found: ${opts.direction}`);
      } else if ((err as NodeJS.ErrnoException).code === "EACCES") {
        console.error(`Cannot read direction file: ${opts.direction}`);
      } else {
        console.error(`Failed to read direction file: ${err}`);
      }
      process.exit(1);
    }
  }

  // Load score.json for replay if provided
  let replayScore: DirectorScore | undefined;
  if (opts.score) {
    try {
      const raw = fs.readFileSync(opts.score, "utf-8");
      replayScore = DirectorScore.parse(JSON.parse(raw));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(`Score file not found: ${opts.score}`);
      } else if (err instanceof SyntaxError) {
        console.error(`Invalid JSON in score file: ${err.message}`);
      } else {
        console.error(`Invalid score file: ${err instanceof Error ? err.message : err}`);
      }
      process.exit(1);
    }

    // Direction is ignored during replay (score already incorporates creative intent)
    if (direction) {
      console.warn("[warning] --direction is ignored when replaying from --score (score already incorporates creative intent)");
      direction = undefined;
    }
  }

  // Validate required API keys before constructing providers
  validateEnv({
    provider: opts.provider,
    ttsProvider: opts.ttsProvider,
    imageProvider: opts.imageProvider,
    videoProvider: opts.videoProvider,
    musicProvider: opts.musicProvider,
    searchProvider: opts.searchProvider,
  });

  // Initialize providers via factory
  const { llm, tts, imageGen, stock, videoProviders, music } = createProviders({
    llm: opts.provider,
    tts: opts.ttsProvider,
    image: opts.imageProvider,
    video: opts.videoProvider,
    videoModel: opts.videoModel,
    music: opts.musicProvider,
    kokoroVoice: opts.kokoroVoice,
    llmModel: opts.llmModel,
    llmBaseUrl: opts.llmBaseUrl,
    searchProvider: opts.searchProvider,
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
      stockVerify: opts.stockVerify,
      stockConfidence: opts.stockConfidence,
      stockMaxAttempts: opts.stockMaxAttempts,
      verifyModel,
      direction,
      replayScore,
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

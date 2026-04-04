import { createRequire } from "node:module";
import { Command, Option } from "commander";
import type { ImageProviderKey, LLMProviderKey, TTSProviderKey, VideoProviderKey } from "../schema/providers.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

export interface CLIOptions {
  topic: string;
  provider: LLMProviderKey;
  imageProvider: ImageProviderKey;
  ttsProvider: TTSProviderKey;
  videoProvider?: VideoProviderKey;
  videoModel?: string;
  noVideo: boolean;
  archetype?: string;
  platform: string;
  dryRun: boolean;
  preview: boolean;
  output: string;
  yes: boolean;
  noMusic: boolean;
  stockVerify: boolean;
  stockConfidence: number;
  stockMaxAttempts: number;
  verificationModel?: string;
}

export function parseArgs(): CLIOptions {
  const program = new Command();

  program
    .name("openreels")
    .description("AI pipeline that turns any topic into a YouTube Short")
    .version(version)
    .argument("<topic>", "The topic for your video")
    .addOption(
      new Option("-p, --provider <provider>", "LLM provider (use 'google' to set LLM+image+video to Gemini)")
        .choices(["anthropic", "openai", "gemini", "google"])
        .default("anthropic"),
    )
    .addOption(
      new Option("-i, --image-provider <provider>", "Image generation provider")
        .choices(["gemini", "openai"])
        .default("gemini"),
    )
    .addOption(
      new Option("--tts-provider <provider>", "TTS provider")
        .choices(["elevenlabs", "inworld"])
        .default("elevenlabs"),
    )
    .option("-a, --archetype <archetype>", "Visual archetype override")
    .option("--platform <platform>", "Target platform (youtube, tiktok, instagram)", "youtube")
    .option("--dry-run", "Output DirectorScore JSON without generating assets", false)
    .option("--preview", "Open Remotion Studio preview after rendering", false)
    .option("-o, --output <dir>", "Output directory", "./output")
    .option("-y, --yes", "Auto-confirm cost estimation prompt (non-interactive mode)", false)
    .option("--music", "Include background music (use --no-music to disable)", true)
    .option("--stock-verify", "Verify stock footage with vision model (use --no-stock-verify to disable)", true)
    .option("--stock-confidence <n>", "Min confidence threshold for stock verification (0-1)", parseFloat, 0.6)
    .option("--stock-max-attempts <n>", "Max stock API calls per scene", parseInt, 4)
    .option("--verification-model <model>", "Model override for stock verification VLM")
    .addOption(
      new Option("--video-provider <provider>", "Video generation provider")
        .choices(["gemini", "fal"])
    )
    .option("--video-model <model>", "Video model override (e.g. veo-3.1-lite-preview, fal-ai/kling-video/v2.1/standard/image-to-video)")
    .option("--video", "Enable AI video generation (use --no-video to disable)", true)
    .parse();

  const topic = program.args[0] ?? "";
  if (!topic) {
    program.error("Topic is required");
  }

  const opts = program.opts();

  // --provider google is a convenience alias that sets LLM+image+video to Gemini.
  // Explicit per-provider flags take precedence over the meta-flag.
  // After this block, opts["provider"] is always a valid LLMProviderKey ("google" is rewritten to "gemini").
  if (opts["provider"] === "google") {
    opts["provider"] = "gemini";
    const imageSource = program.getOptionValueSource("imageProvider");
    if (!imageSource || imageSource === "default") {
      opts["imageProvider"] = "gemini";
    }
    const videoSource = program.getOptionValueSource("videoProvider");
    if (!videoSource || videoSource === "default") {
      opts["videoProvider"] = "gemini";
    }
  }

  return {
    topic,
    provider: opts["provider"] as LLMProviderKey,
    imageProvider: opts["imageProvider"] as ImageProviderKey,
    ttsProvider: opts["ttsProvider"] as TTSProviderKey,
    videoProvider: opts["videoProvider"] as VideoProviderKey | undefined,
    videoModel: opts["videoModel"] as string | undefined,
    noVideo: opts["video"] === false,
    archetype: opts["archetype"] as string | undefined,
    platform: opts["platform"] as string,
    dryRun: opts["dryRun"] as boolean,
    preview: opts["preview"] as boolean,
    output: opts["output"] as string,
    yes: opts["yes"] as boolean,
    noMusic: opts["music"] === false,
    stockVerify: opts["stockVerify"] as boolean,
    stockConfidence: opts["stockConfidence"] as number,
    stockMaxAttempts: opts["stockMaxAttempts"] as number,
    verificationModel: opts["verificationModel"] as string | undefined,
  };
}

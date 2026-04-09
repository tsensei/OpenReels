import { createRequire } from "node:module";
import { Command, Option } from "commander";
import { PACING_CONFIG } from "../agents/creative-director.js";
import type {
  ImageProviderKey,
  LLMProviderKey,
  MusicProviderKey,
  SearchProviderKey,
  TTSProviderKey,
  VideoProviderKey,
} from "../schema/providers.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

export interface CLIOptions {
  topic: string;
  provider: LLMProviderKey;
  imageProvider: ImageProviderKey;
  ttsProvider: TTSProviderKey;
  videoProvider?: VideoProviderKey;
  videoModel?: string;
  musicProvider: MusicProviderKey;
  kokoroVoice?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  searchProvider?: SearchProviderKey;
  noVideo: boolean;
  archetype?: string;
  pacing?: string;
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
  usage: boolean;
}

function makeUsageResult(outputDir: string): CLIOptions {
  return {
    topic: "",
    provider: "anthropic" as LLMProviderKey,
    imageProvider: "gemini" as ImageProviderKey,
    ttsProvider: "elevenlabs" as TTSProviderKey,
    musicProvider: "bundled" as MusicProviderKey,
    noVideo: false,
    platform: "youtube",
    dryRun: false,
    preview: false,
    output: outputDir,
    yes: false,
    noMusic: false,
    stockVerify: true,
    stockConfidence: 0.6,
    stockMaxAttempts: 4,
    usage: true,
  };
}

export function parseArgs(): CLIOptions {
  // Check for --usage before commander parses, because `pnpm start -- --usage`
  // puts a `--` in argv that stops commander's option parsing.
  if (process.argv.includes("--usage")) {
    // Extract -o/--output if provided alongside --usage
    const oIdx = process.argv.indexOf("-o");
    const outIdx = process.argv.indexOf("--output");
    const idx = oIdx !== -1 ? oIdx : outIdx;
    const outputDir = idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1]! : "./output";
    return makeUsageResult(outputDir);
  }

  const program = new Command();

  program
    .name("openreels")
    .description("AI pipeline that turns any topic into a YouTube Short")
    .version(version)
    .argument("[topic]", "The topic for your video")
    .addOption(
      new Option(
        "-p, --provider <provider>",
        "LLM provider (use 'google' to set LLM+image+video to Gemini)",
      )
        .choices([
          "anthropic",
          "openai",
          "gemini",
          "openrouter",
          "openai-compatible",
          "google",
          "local",
        ])
        .default("anthropic"),
    )
    .option(
      "--llm-model <model>",
      "Model ID override (e.g. anthropic/claude-sonnet-4 for OpenRouter)",
    )
    .option(
      "--llm-base-url <url>",
      "Base URL for openai-compatible provider (e.g. http://localhost:11434/v1)",
    )
    .addOption(
      new Option(
        "--search-provider <provider>",
        "Search provider for web research (native uses provider built-in, tavily uses Tavily API)",
      ).choices(["native", "tavily", "none"]),
    )
    .addOption(
      new Option("-i, --image-provider <provider>", "Image generation provider")
        .choices(["gemini", "openai"])
        .default("gemini"),
    )
    .addOption(
      new Option("--tts-provider <provider>", "TTS provider")
        .choices(["elevenlabs", "inworld", "kokoro", "gemini-tts", "openai-tts"])
        .default("elevenlabs"),
    )
    .option(
      "--kokoro-voice <voice>",
      "Kokoro voice preset (e.g. af_heart, bf_emma, am_fenrir)",
      "af_heart",
    )
    .option("-a, --archetype <archetype>", "Visual archetype override")
    .addOption(
      new Option("--pacing <tier>", "Pacing tier override (overrides archetype default)").choices(
        Object.keys(PACING_CONFIG),
      ),
    )
    .option("--platform <platform>", "Target platform (youtube, tiktok, instagram)", "youtube")
    .option("--dry-run", "Output DirectorScore JSON without generating assets", false)
    .option("--preview", "Open Remotion Studio preview after rendering", false)
    .option("-o, --output <dir>", "Output directory", "./output")
    .option("-y, --yes", "Auto-confirm cost estimation prompt (non-interactive mode)", false)
    .addOption(
      new Option("--music-provider <provider>", "Music provider")
        .choices(["bundled", "lyria"])
        .default("bundled"),
    )
    .option("--music", "Include background music (use --no-music to disable)", true)
    .option(
      "--stock-verify",
      "Verify stock footage with vision model (use --no-stock-verify to disable)",
      true,
    )
    .option(
      "--stock-confidence <n>",
      "Min confidence threshold for stock verification (0-1)",
      parseFloat,
      0.6,
    )
    .option("--stock-max-attempts <n>", "Max stock API calls per scene", parseInt, 4)
    .option("--verification-model <model>", "Model override for stock verification VLM")
    .addOption(
      new Option("--video-provider <provider>", "Video generation provider").choices([
        "gemini",
        "fal",
      ]),
    )
    .option(
      "--video-model <model>",
      "Video model override (e.g. veo-3.1-lite-preview, fal-ai/kling-video/v2.1/standard/image-to-video)",
    )
    .option("--video", "Enable AI video generation (use --no-video to disable)", true)
    .option("--usage", "Show cost usage report from past runs in the output directory", false)
    .parse();

  const opts = program.opts();

  // --usage flag or "usage" as topic → show cost report
  if (opts["usage"] || program.args[0] === "usage") {
    return makeUsageResult((opts["output"] as string) ?? "./output");
  }

  const topic = program.args[0] ?? "";
  if (!topic) {
    program.error("Topic is required");
  }

  // --provider google is a convenience alias that sets LLM+image+video to Gemini.
  // --provider local sets TTS to Kokoro (free local inference, no API key needed).
  // Explicit per-provider flags take precedence over meta-flags.
  // After this block, opts["provider"] is always a valid LLMProviderKey.
  if (opts["provider"] === "google") {
    opts["provider"] = "gemini";
    const imageSource = program.getOptionValueSource("imageProvider");
    if (!imageSource || imageSource === "default") {
      opts["imageProvider"] = "gemini";
    }
    const ttsSource = program.getOptionValueSource("ttsProvider");
    if (!ttsSource || ttsSource === "default") {
      opts["ttsProvider"] = "gemini-tts";
    }
    const videoSource = program.getOptionValueSource("videoProvider");
    if (!videoSource || videoSource === "default") {
      opts["videoProvider"] = "gemini";
    }
    const musicSource = program.getOptionValueSource("musicProvider");
    if (!musicSource || musicSource === "default") {
      opts["musicProvider"] = "lyria";
    }
  } else if (opts["provider"] === "openai-compatible") {
    if (!opts["llmBaseUrl"]) {
      program.error("--llm-base-url is required when using --provider openai-compatible");
    }
    if (!opts["llmModel"]) {
      program.error("--llm-model is required when using --provider openai-compatible");
    }
  } else if (opts["provider"] === "local") {
    opts["provider"] = "anthropic"; // LLM defaults unchanged
    const ttsSource = program.getOptionValueSource("ttsProvider");
    if (!ttsSource || ttsSource === "default") {
      opts["ttsProvider"] = "kokoro";
    }
  }

  return {
    topic,
    provider: opts["provider"] as LLMProviderKey,
    imageProvider: opts["imageProvider"] as ImageProviderKey,
    ttsProvider: opts["ttsProvider"] as TTSProviderKey,
    videoProvider: opts["videoProvider"] as VideoProviderKey | undefined,
    videoModel: opts["videoModel"] as string | undefined,
    musicProvider: opts["musicProvider"] as MusicProviderKey,
    kokoroVoice: opts["kokoroVoice"] as string | undefined,
    llmModel: opts["llmModel"] as string | undefined,
    llmBaseUrl: opts["llmBaseUrl"] as string | undefined,
    searchProvider: opts["searchProvider"] as SearchProviderKey | undefined,
    noVideo: opts["video"] === false,
    archetype: opts["archetype"] as string | undefined,
    pacing: opts["pacing"] as string | undefined,
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
    usage: false,
  };
}

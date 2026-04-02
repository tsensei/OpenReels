import { createRequire } from "node:module";
import { Command, Option } from "commander";
import type { ImageProviderKey, LLMProviderKey, TTSProviderKey } from "../schema/providers.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

export interface CLIOptions {
  topic: string;
  provider: LLMProviderKey;
  imageProvider: ImageProviderKey;
  ttsProvider: TTSProviderKey;
  archetype?: string;
  platform: string;
  dryRun: boolean;
  preview: boolean;
  output: string;
  yes: boolean;
  brief?: string;
  /** Explicitly provided via --ollama-model. When undefined, model is selected interactively. */
  ollamaModel?: string;
  /** Explicitly provided via --ollama-image-model. When undefined, model is selected interactively. */
  ollamaImageModel?: string;
  ollamaHost: string;
  chatterboxDevice?: string;
  chatterboxAudioPrompt?: string;
}

export function parseArgs(): CLIOptions {
  const program = new Command();

  program
    .name("openreels")
    .description("AI pipeline that turns any topic into a YouTube Short")
    .version(version)
    .argument("<topic>", "The topic for your video")
    .addOption(
      new Option("-p, --provider <provider>", "LLM provider")
        .choices(["anthropic", "openai", "ollama"])
        .default("anthropic"),
    )
    .addOption(
      new Option("-i, --image-provider <provider>", "Image generation provider")
        .choices(["gemini", "openai", "ollama"])
        .default("gemini"),
    )
    .addOption(
      new Option("--tts-provider <provider>", "TTS provider")
        .choices(["elevenlabs", "inworld", "chatterbox"])
        .default("elevenlabs"),
    )
    .option("-a, --archetype <archetype>", "Visual archetype override")
    .option("--platform <platform>", "Target platform (youtube, tiktok, instagram)", "youtube")
    .option("--dry-run", "Output DirectorScore JSON without generating assets", false)
    .option("--preview", "Open Remotion Studio preview after rendering", false)
    .option("-o, --output <dir>", "Output directory", "./output")
    .option("-y, --yes", "Auto-confirm cost estimation prompt (non-interactive mode)", false)
    .option("--brief <text>", "Topic context for Ollama mode (skips interactive prompt)")
    .option("--ollama-model <name>", "Ollama LLM model name (default: interactive selection)")
    .option("--ollama-image-model <name>", "Ollama image generation model name (default: interactive selection)")
    .option("--ollama-host <url>", "Ollama API host", "http://localhost:11434")
    .option("--chatterbox-device <device>", "PyTorch device for Chatterbox TTS (cpu, cuda, mps)")
    .option("--chatterbox-audio-prompt <path>", "Path to reference WAV for Chatterbox voice cloning")
    .parse();

  const topic = program.args[0] ?? "";
  if (!topic) {
    program.error("Topic is required");
  }

  const opts = program.opts();

  return {
    topic,
    provider: opts["provider"] as LLMProviderKey,
    imageProvider: opts["imageProvider"] as ImageProviderKey,
    ttsProvider: opts["ttsProvider"] as TTSProviderKey,
    archetype: opts["archetype"] as string | undefined,
    platform: opts["platform"] as string,
    dryRun: opts["dryRun"] as boolean,
    preview: opts["preview"] as boolean,
    output: opts["output"] as string,
    yes: opts["yes"] as boolean,
    brief: opts["brief"] as string | undefined,
    ollamaModel: opts["ollamaModel"] as string | undefined,
    ollamaImageModel: opts["ollamaImageModel"] as string | undefined,
    ollamaHost: opts["ollamaHost"] as string,
    chatterboxDevice: opts["chatterboxDevice"] as string | undefined,
    chatterboxAudioPrompt: opts["chatterboxAudioPrompt"] as string | undefined,
  };
}

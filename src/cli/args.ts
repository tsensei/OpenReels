import { createRequire } from "node:module";
import { Command, Option } from "commander";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

export interface CLIOptions {
  topic: string;
  provider: "anthropic" | "openai";
  imageProvider: "gemini" | "openai";
  archetype?: string;
  platform: string;
  dryRun: boolean;
  preview: boolean;
  output: string;
}

export function parseArgs(): CLIOptions {
  const program = new Command();

  program
    .name("openreels")
    .description("AI pipeline that turns any topic into a YouTube Short")
    .version(version)
    .argument("<topic>", "The topic for your video")
    .addOption(new Option("-p, --provider <provider>", "LLM provider").choices(["anthropic", "openai"]).default("anthropic"))
    .addOption(new Option("-i, --image-provider <provider>", "Image generation provider").choices(["gemini", "openai"]).default("gemini"))
    .option("-a, --archetype <archetype>", "Visual archetype override")
    .option("--platform <platform>", "Target platform (youtube, tiktok, instagram)", "youtube")
    .option("--dry-run", "Output DirectorScore JSON without generating assets", false)
    .option("--preview", "Open Remotion Studio preview after rendering", false)
    .option("-o, --output <dir>", "Output directory", "./output")
    .parse();

  const topic = program.args[0] ?? "";
  if (!topic) {
    program.error("Topic is required");
  }

  const opts = program.opts();

  return {
    topic,
    provider: opts["provider"] as "anthropic" | "openai",
    imageProvider: opts["imageProvider"] as "gemini" | "openai",
    archetype: opts["archetype"] as string | undefined,
    platform: opts["platform"] as string,
    dryRun: opts["dryRun"] as boolean,
    preview: opts["preview"] as boolean,
    output: opts["output"] as string,
  };
}

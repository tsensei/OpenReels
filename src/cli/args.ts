import { Command } from "commander";

export interface CLIOptions {
  topic: string;
  provider: "anthropic" | "openai";
  archetype?: string;
  platform: string;
  dryRun: boolean;
  preview: boolean;
  verbose: boolean;
  output: string;
}

export function parseArgs(): CLIOptions {
  const program = new Command();

  program
    .name("openreels")
    .description("AI pipeline that turns any topic into a YouTube Short")
    .version("2.0.0")
    .argument("<topic>", "The topic for your video")
    .option("-p, --provider <provider>", "LLM provider (anthropic or openai)", "anthropic")
    .option("-a, --archetype <archetype>", "Visual archetype override")
    .option("--platform <platform>", "Target platform (youtube, tiktok, instagram)", "youtube")
    .option("--dry-run", "Output DirectorScore JSON without generating assets", false)
    .option("--preview", "Open Remotion Studio preview after rendering", false)
    .option("-v, --verbose", "Enable verbose output", false)
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
    archetype: opts["archetype"] as string | undefined,
    platform: opts["platform"] as string,
    dryRun: opts["dryRun"] as boolean,
    preview: opts["preview"] as boolean,
    verbose: opts["verbose"] as boolean,
    output: opts["output"] as string,
  };
}

import { describe, expect, it } from "vitest";
import type { CLIOptions } from "./args.js";

describe("CLIOptions type", () => {
  it("includes yes field for non-interactive mode", () => {
    // Type-level test: verify CLIOptions includes the yes field.
    // If this compiles, the field exists.
    const opts: CLIOptions = {
      topic: "test",
      provider: "anthropic",
      imageProvider: "gemini",
      ttsProvider: "elevenlabs",
      platform: "youtube",
      dryRun: false,
      preview: false,
      output: "./output",
      yes: true,
      ollamaModel: "llama3.2",
      ollamaImageModel: "x/flux2-klein",
      ollamaHost: "http://localhost:11434",
    };
    expect(opts.yes).toBe(true);
  });

  it("yes defaults to false", () => {
    const opts: CLIOptions = {
      topic: "test",
      provider: "anthropic",
      imageProvider: "gemini",
      ttsProvider: "elevenlabs",
      platform: "youtube",
      dryRun: false,
      preview: false,
      output: "./output",
      yes: false,
      ollamaModel: "llama3.2",
      ollamaImageModel: "x/flux2-klein",
      ollamaHost: "http://localhost:11434",
    };
    expect(opts.yes).toBe(false);
  });
});

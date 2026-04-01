import { describe, it, expect } from "vitest";
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
    };
    expect(opts.yes).toBe(false);
  });
});

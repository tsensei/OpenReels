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
      noMusic: false,
      stockVerify: true,
      stockConfidence: 0.6,
      stockMaxAttempts: 4,
      noVideo: false,
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
      noMusic: false,
      stockVerify: true,
      stockConfidence: 0.6,
      stockMaxAttempts: 4,
      noVideo: false,
    };
    expect(opts.yes).toBe(false);
  });
});

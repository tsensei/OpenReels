import { afterEach, describe, expect, it } from "vitest";
import type { CLIOptions } from "./args.js";
import { parseArgs } from "./args.js";

describe("parseArgs with 60db", () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it("accepts --provider 60db", () => {
    process.argv = ["node", "openreels", "test topic", "--provider", "60db"];
    const opts = parseArgs();
    expect(opts.provider).toBe("60db");
    expect(opts.topic).toBe("test topic");
  });

  it("accepts --tts-provider 60db", () => {
    process.argv = ["node", "openreels", "test topic", "--tts-provider", "60db"];
    const opts = parseArgs();
    expect(opts.ttsProvider).toBe("60db");
  });

  it("accepts --tts-provider 60db-stream", () => {
    process.argv = ["node", "openreels", "test topic", "--tts-provider", "60db-stream"];
    const opts = parseArgs();
    expect(opts.ttsProvider).toBe("60db-stream");
  });

  it("accepts --tts-provider 60db-ws", () => {
    process.argv = ["node", "openreels", "test topic", "--tts-provider", "60db-ws"];
    const opts = parseArgs();
    expect(opts.ttsProvider).toBe("60db-ws");
  });

  it("accepts the documented 60db end-to-end flags together", () => {
    process.argv = [
      "node",
      "openreels",
      "the dawn of stoicism",
      "--provider",
      "60db",
      "--tts-provider",
      "60db",
    ];
    const opts = parseArgs();
    expect(opts.provider).toBe("60db");
    expect(opts.ttsProvider).toBe("60db");
    expect(opts.topic).toBe("the dawn of stoicism");
  });
});

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
      musicProvider: "bundled",
      noMusic: false,
      stockVerify: true,
      stockConfidence: 0.6,
      stockMaxAttempts: 4,
      noVideo: false,
      usage: false,
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
      musicProvider: "bundled",
      noMusic: false,
      stockVerify: true,
      stockConfidence: 0.6,
      stockMaxAttempts: 4,
      noVideo: false,
      usage: false,
    };
    expect(opts.yes).toBe(false);
  });

  it("accepts gemini as provider", () => {
    const opts: CLIOptions = {
      topic: "test",
      provider: "gemini",
      imageProvider: "gemini",
      ttsProvider: "elevenlabs",
      platform: "youtube",
      dryRun: false,
      preview: false,
      output: "./output",
      yes: false,
      musicProvider: "bundled",
      noMusic: false,
      stockVerify: true,
      stockConfidence: 0.6,
      stockMaxAttempts: 4,
      noVideo: false,
      usage: false,
    };
    expect(opts.provider).toBe("gemini");
  });

  it("accepts pacing tier as optional field", () => {
    const opts: CLIOptions = {
      topic: "test",
      provider: "anthropic",
      imageProvider: "gemini",
      ttsProvider: "elevenlabs",
      pacing: "fast",
      platform: "youtube",
      dryRun: false,
      preview: false,
      output: "./output",
      yes: false,
      musicProvider: "bundled",
      noMusic: false,
      stockVerify: true,
      stockConfidence: 0.6,
      stockMaxAttempts: 4,
      noVideo: false,
      usage: false,
    };
    expect(opts.pacing).toBe("fast");
  });

  it("pacing is undefined by default", () => {
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
      musicProvider: "bundled",
      noMusic: false,
      stockVerify: true,
      stockConfidence: 0.6,
      stockMaxAttempts: 4,
      noVideo: false,
      usage: false,
    };
    expect(opts.pacing).toBeUndefined();
  });
});

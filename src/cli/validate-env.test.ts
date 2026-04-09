import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnv } from "./validate-env.js";

// biome-ignore lint: test spies
let exitSpy: any;
// biome-ignore lint: test spies
let errorSpy: any;
// biome-ignore lint: test spies
let warnSpy: any;

beforeEach(() => {
  exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateEnv", () => {
  it("passes when all default provider keys are set", () => {
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";

    validateEnv({ provider: "anthropic", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    expect(exitSpy).not.toHaveBeenCalled();

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });

  it("exits when ANTHROPIC_API_KEY is missing for default provider", () => {
    delete process.env["ANTHROPIC_API_KEY"];
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";

    validateEnv({ provider: "anthropic", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    expect(exitSpy).toHaveBeenCalledWith(1);

    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });

  it("requires OPENAI_API_KEY when --provider openai", () => {
    delete process.env["OPENAI_API_KEY"];
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";

    validateEnv({ provider: "openai", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = errorSpy.mock.calls.flat().join("");
    expect(output).toContain("OPENAI_API_KEY");

    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });

  it("requires OPENAI_API_KEY when --image-provider openai", () => {
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";
    delete process.env["OPENAI_API_KEY"];

    validateEnv({ provider: "anthropic", ttsProvider: "elevenlabs", imageProvider: "openai" });

    expect(exitSpy).toHaveBeenCalledWith(1);

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
  });

  it("requires INWORLD_TTS_API_KEY when --tts-provider inworld", () => {
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";
    delete process.env["INWORLD_TTS_API_KEY"];

    validateEnv({ provider: "anthropic", ttsProvider: "inworld", imageProvider: "gemini" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = errorSpy.mock.calls.flat().join("");
    expect(output).toContain("INWORLD_TTS_API_KEY");

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });

  it("requires GOOGLE_API_KEY when --provider gemini", () => {
    delete process.env["GOOGLE_API_KEY"];
    process.env["ELEVENLABS_API_KEY"] = "test";

    validateEnv({ provider: "gemini", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = errorSpy.mock.calls.flat().join("");
    expect(output).toContain("GOOGLE_API_KEY");

    delete process.env["ELEVENLABS_API_KEY"];
  });

  it("requires GOOGLE_API_KEY when --video-provider gemini", () => {
    delete process.env["GOOGLE_API_KEY"];
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";

    validateEnv({
      provider: "anthropic",
      ttsProvider: "elevenlabs",
      imageProvider: "openai",
      videoProvider: "gemini",
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = errorSpy.mock.calls.flat().join("");
    expect(output).toContain("GOOGLE_API_KEY");

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
  });

  it("passes when --provider gemini and GOOGLE_API_KEY is set", () => {
    process.env["GOOGLE_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";

    validateEnv({ provider: "gemini", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    expect(exitSpy).not.toHaveBeenCalled();

    delete process.env["GOOGLE_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
  });

  it("does not require optional PEXELS_API_KEY or PIXABAY_API_KEY", () => {
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";
    delete process.env["PEXELS_API_KEY"];
    delete process.env["PIXABAY_API_KEY"];

    validateEnv({ provider: "anthropic", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    expect(exitSpy).not.toHaveBeenCalled();

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });

  it("warns when no stock media API key is set", () => {
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";
    delete process.env["PEXELS_API_KEY"];
    delete process.env["PIXABAY_API_KEY"];

    validateEnv({ provider: "anthropic", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    const output = warnSpy.mock.calls.flat().join("");
    expect(output).toContain("No stock media API key found");

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });

  it("does not warn about stock keys when PEXELS_API_KEY is set", () => {
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";
    process.env["PEXELS_API_KEY"] = "test";

    validateEnv({ provider: "anthropic", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    const output = warnSpy.mock.calls.flat().join("");
    expect(output).not.toContain("No stock media API key found");

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
    delete process.env["PEXELS_API_KEY"];
  });

  it("requires GOOGLE_API_KEY when --music-provider lyria", () => {
    delete process.env["GOOGLE_API_KEY"];
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";

    validateEnv({
      provider: "anthropic",
      ttsProvider: "elevenlabs",
      imageProvider: "openai",
      musicProvider: "lyria",
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = errorSpy.mock.calls.flat().join("");
    expect(output).toContain("GOOGLE_API_KEY");

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
  });

  it("does not require GOOGLE_API_KEY when --music-provider bundled", () => {
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["OPENAI_API_KEY"] = "test";
    delete process.env["GOOGLE_API_KEY"];

    validateEnv({
      provider: "anthropic",
      ttsProvider: "elevenlabs",
      imageProvider: "openai",
      musicProvider: "bundled",
    });

    expect(exitSpy).not.toHaveBeenCalled();

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["OPENAI_API_KEY"];
  });

  it("requires OPENROUTER_API_KEY when --provider openrouter", () => {
    delete process.env["OPENROUTER_API_KEY"];
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";

    validateEnv({ provider: "openrouter", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = errorSpy.mock.calls.flat().join("");
    expect(output).toContain("OPENROUTER_API_KEY");

    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });

  it("requires TAVILY_API_KEY when --search-provider tavily is explicit", () => {
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";
    delete process.env["TAVILY_API_KEY"];

    validateEnv({
      provider: "anthropic",
      ttsProvider: "elevenlabs",
      imageProvider: "gemini",
      searchProvider: "tavily",
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = errorSpy.mock.calls.flat().join("");
    expect(output).toContain("TAVILY_API_KEY");

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });

  it("warns when openrouter without TAVILY_API_KEY and no explicit search", () => {
    process.env["OPENROUTER_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";
    delete process.env["TAVILY_API_KEY"];

    validateEnv({ provider: "openrouter", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    const output = warnSpy.mock.calls.flat().join("");
    expect(output).toContain("TAVILY_API_KEY not set");

    delete process.env["OPENROUTER_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });

  it("does not warn about TAVILY when using anthropic provider", () => {
    process.env["ANTHROPIC_API_KEY"] = "test";
    process.env["ELEVENLABS_API_KEY"] = "test";
    process.env["GOOGLE_API_KEY"] = "test";
    delete process.env["TAVILY_API_KEY"];

    validateEnv({ provider: "anthropic", ttsProvider: "elevenlabs", imageProvider: "gemini" });

    const output = warnSpy.mock.calls.flat().join("");
    expect(output).not.toContain("TAVILY_API_KEY");

    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
  });
});

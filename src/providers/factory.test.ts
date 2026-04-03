import { describe, expect, it, vi } from "vitest";
import { createProviders } from "./factory.js";
import { GeminiImage } from "./image/gemini.js";
import { OpenAIImage } from "./image/openai.js";
import { PexelsStock } from "./stock/pexels.js";
import { PixabayStock } from "./stock/pixabay.js";
import { ElevenLabsTTS } from "./tts/elevenlabs.js";
import { InworldTTS } from "./tts/inworld.js";

// Mock TTS providers
vi.mock("./tts/elevenlabs.js", () => ({
  ElevenLabsTTS: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./tts/inworld.js", () => ({
  InworldTTS: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
// Mock image providers (kept as custom implementations)
vi.mock("./image/gemini.js", () => ({
  GeminiImage: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./image/openai.js", () => ({
  OpenAIImage: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
// Mock stock providers
vi.mock("./stock/pexels.js", () => ({
  PexelsStock: vi.fn().mockImplementation(() => ({ searchVideo: vi.fn(), searchImage: vi.fn() })),
}));
vi.mock("./stock/pixabay.js", () => ({
  PixabayStock: vi.fn().mockImplementation(() => ({ searchVideo: vi.fn(), searchImage: vi.fn() })),
}));
// Mock Vercel AI SDK providers
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ modelId: "claude-sonnet-4-20250514" })),
}));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ modelId: "gpt-4o" })),
}));

describe("createProviders", () => {
  it("creates default providers (anthropic model + elevenlabs + gemini + pexels)", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
    });

    expect(providers.model).toBeDefined();
    expect(providers.tts).toBeDefined();
    expect(providers.imageGen).toBeDefined();
    expect(providers.stock).toBeDefined();
    expect(ElevenLabsTTS).toHaveBeenCalled();
    expect(GeminiImage).toHaveBeenCalled();
    expect(PexelsStock).toHaveBeenCalled();
  });

  it("creates openai-based providers when specified", () => {
    vi.mocked(InworldTTS).mockClear();
    vi.mocked(OpenAIImage).mockClear();
    vi.mocked(PixabayStock).mockClear();

    createProviders({
      llm: "openai",
      tts: "inworld",
      image: "openai",
      stock: "pixabay",
    });

    expect(InworldTTS).toHaveBeenCalled();
    expect(OpenAIImage).toHaveBeenCalled();
    expect(PixabayStock).toHaveBeenCalled();
  });

  it("passes BYOK keys to provider constructors", () => {
    vi.mocked(ElevenLabsTTS).mockClear();
    vi.mocked(GeminiImage).mockClear();
    vi.mocked(PexelsStock).mockClear();

    createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
      keys: {
        ANTHROPIC_API_KEY: "test-ant-key",
        ELEVENLABS_API_KEY: "test-el-key",
        GOOGLE_API_KEY: "test-goog-key",
        PEXELS_API_KEY: "test-pex-key",
      },
    });

    expect(ElevenLabsTTS).toHaveBeenCalledWith(undefined, "test-el-key");
    expect(GeminiImage).toHaveBeenCalledWith(undefined, "test-goog-key");
    expect(PexelsStock).toHaveBeenCalledWith("test-pex-key");
  });

  it("returns a LanguageModel (not an LLMProvider class)", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
    });

    // Model is now a Vercel AI SDK LanguageModel, not our custom class
    expect(providers.model).toBeDefined();
    expect(typeof providers.model).toBe("object");
  });
});

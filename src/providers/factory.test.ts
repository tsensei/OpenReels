import { describe, expect, it, vi } from "vitest";
import { createProviders } from "./factory.js";
import { GeminiImage } from "./image/gemini.js";
import { OpenAIImage } from "./image/openai.js";
import { AnthropicLLM } from "./llm/anthropic.js";
import { OpenAILLM } from "./llm/openai.js";
import { PexelsStock } from "./stock/pexels.js";
import { PixabayStock } from "./stock/pixabay.js";
import { ElevenLabsTTS } from "./tts/elevenlabs.js";
import { InworldTTS } from "./tts/inworld.js";

vi.mock("./llm/anthropic.js", () => ({
  AnthropicLLM: vi.fn().mockImplementation(() => ({ id: "anthropic", generate: vi.fn() })),
}));
vi.mock("./llm/openai.js", () => ({
  OpenAILLM: vi.fn().mockImplementation(() => ({ id: "openai", generate: vi.fn() })),
}));
vi.mock("./tts/elevenlabs.js", () => ({
  ElevenLabsTTS: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./tts/inworld.js", () => ({
  InworldTTS: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./image/gemini.js", () => ({
  GeminiImage: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./image/openai.js", () => ({
  OpenAIImage: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./stock/pexels.js", () => ({
  PexelsStock: vi.fn().mockImplementation(() => ({ searchVideo: vi.fn(), searchImage: vi.fn() })),
}));
vi.mock("./stock/pixabay.js", () => ({
  PixabayStock: vi.fn().mockImplementation(() => ({ searchVideo: vi.fn(), searchImage: vi.fn() })),
}));

describe("createProviders", () => {
  it("creates default providers (anthropic + elevenlabs + gemini + pexels)", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
    });

    expect(providers.llm).toBeDefined();
    expect(providers.tts).toBeDefined();
    expect(providers.imageGen).toBeDefined();
    expect(providers.stock).toBeDefined();
    expect(AnthropicLLM).toHaveBeenCalled();
    expect(ElevenLabsTTS).toHaveBeenCalled();
    expect(GeminiImage).toHaveBeenCalled();
    expect(PexelsStock).toHaveBeenCalled();
  });

  it("creates openai providers when specified", () => {
    vi.mocked(OpenAILLM).mockClear();
    vi.mocked(InworldTTS).mockClear();
    vi.mocked(OpenAIImage).mockClear();
    vi.mocked(PixabayStock).mockClear();

    createProviders({
      llm: "openai",
      tts: "inworld",
      image: "openai",
      stock: "pixabay",
    });

    expect(OpenAILLM).toHaveBeenCalled();
    expect(InworldTTS).toHaveBeenCalled();
    expect(OpenAIImage).toHaveBeenCalled();
    expect(PixabayStock).toHaveBeenCalled();
  });

  it("passes BYOK keys to provider constructors", () => {
    vi.mocked(AnthropicLLM).mockClear();
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

    expect(AnthropicLLM).toHaveBeenCalledWith(undefined, "test-ant-key");
    expect(ElevenLabsTTS).toHaveBeenCalledWith(undefined, "test-el-key");
    expect(GeminiImage).toHaveBeenCalledWith(undefined, "test-goog-key");
    expect(PexelsStock).toHaveBeenCalledWith("test-pex-key");
  });

  it("passes undefined keys when no BYOK keys provided", () => {
    vi.mocked(AnthropicLLM).mockClear();

    createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
    });

    expect(AnthropicLLM).toHaveBeenCalledWith(undefined, undefined);
  });
});

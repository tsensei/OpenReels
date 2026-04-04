import { describe, expect, it, vi, beforeEach } from "vitest";
import { createProviders } from "./factory.js";
import { GeminiImage } from "./image/gemini.js";
import { OpenAIImage } from "./image/openai.js";
import { AnthropicLLM } from "./llm/anthropic.js";
import { GeminiLLM } from "./llm/gemini.js";
import { OpenAILLM } from "./llm/openai.js";
import { PexelsStock } from "./stock/pexels.js";
import { PixabayStock } from "./stock/pixabay.js";
import { AlignedTTSProvider } from "./tts/aligned-tts-provider.js";
import { ElevenLabsTTS } from "./tts/elevenlabs.js";
import { GeminiTTS } from "./tts/gemini.js";
import { InworldTTS } from "./tts/inworld.js";
import { KokoroTTS } from "./tts/kokoro.js";
import { OpenAITTS } from "./tts/openai.js";
import { BundledMusic } from "./music/bundled-adapter.js";
import { LyriaMusic } from "./music/lyria.js";

vi.mock("./llm/anthropic.js", () => ({
  AnthropicLLM: vi.fn().mockImplementation(() => ({ id: "anthropic", generate: vi.fn() })),
}));
vi.mock("./llm/gemini.js", () => ({
  GeminiLLM: vi.fn().mockImplementation(() => ({ id: "gemini", generate: vi.fn() })),
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
vi.mock("./tts/kokoro.js", () => ({
  KokoroTTS: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./tts/gemini.js", () => ({
  GeminiTTS: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./tts/openai.js", () => ({
  OpenAITTS: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./tts/aligned-tts-provider.js", () => ({
  AlignedTTSProvider: vi.fn().mockImplementation((inner) => ({ generate: vi.fn(), _inner: inner })),
}));
vi.mock("./tts/whisper-aligner.js", () => ({
  WhisperAligner: vi.fn().mockImplementation(() => ({ align: vi.fn() })),
}));
vi.mock("./image/gemini.js", () => ({
  GeminiImage: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./image/openai.js", () => ({
  OpenAIImage: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./stock/pexels.js", () => ({
  PexelsStock: vi.fn().mockImplementation(() => ({ searchVideo: vi.fn(), searchImage: vi.fn(), download: vi.fn() })),
}));
vi.mock("./stock/pixabay.js", () => ({
  PixabayStock: vi.fn().mockImplementation(() => ({ searchVideo: vi.fn(), searchImage: vi.fn(), download: vi.fn() })),
}));
vi.mock("./music/bundled-adapter.js", () => ({
  BundledMusic: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));
vi.mock("./music/lyria.js", () => ({
  LyriaMusic: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
}));

describe("createProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates default providers with BYOK keys (pexels primary)", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
      keys: { PEXELS_API_KEY: "test-pex" },
    });

    expect(providers.llm).toBeDefined();
    expect(providers.tts).toBeDefined();
    expect(providers.imageGen).toBeDefined();
    expect(providers.stock).toBeInstanceOf(Array);
    expect(providers.stock.length).toBe(1);
    expect(AnthropicLLM).toHaveBeenCalled();
    expect(ElevenLabsTTS).toHaveBeenCalled();
    expect(GeminiImage).toHaveBeenCalled();
    expect(PexelsStock).toHaveBeenCalledWith("test-pex");
  });

  it("creates both stock providers when both keys available", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
      keys: { PEXELS_API_KEY: "test-pex", PIXABAY_API_KEY: "test-pix" },
    });

    expect(providers.stock.length).toBe(2);
    expect(PexelsStock).toHaveBeenCalledWith("test-pex");
    expect(PixabayStock).toHaveBeenCalledWith("test-pix");
  });

  it("orders pixabay first when stock config is pixabay", () => {
    const providers = createProviders({
      llm: "openai",
      tts: "inworld",
      image: "openai",
      stock: "pixabay",
      keys: { PEXELS_API_KEY: "test-pex", PIXABAY_API_KEY: "test-pix" },
    });

    expect(OpenAILLM).toHaveBeenCalled();
    expect(InworldTTS).toHaveBeenCalled();
    expect(OpenAIImage).toHaveBeenCalled();
    // Pixabay should be first since stock config is "pixabay"
    expect(providers.stock.length).toBe(2);
    expect(PixabayStock).toHaveBeenCalled();
    expect(PexelsStock).toHaveBeenCalled();
  });

  it("returns empty stock array when no stock keys available", () => {
    // Clear env vars that might be set
    const origPexels = process.env["PEXELS_API_KEY"];
    const origPixabay = process.env["PIXABAY_API_KEY"];
    delete process.env["PEXELS_API_KEY"];
    delete process.env["PIXABAY_API_KEY"];

    const providers = createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
    });

    expect(providers.stock).toBeInstanceOf(Array);
    expect(providers.stock.length).toBe(0);

    // Restore
    if (origPexels) process.env["PEXELS_API_KEY"] = origPexels;
    if (origPixabay) process.env["PIXABAY_API_KEY"] = origPixabay;
  });

  it("passes BYOK keys to provider constructors", () => {
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
    createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
    });

    expect(AnthropicLLM).toHaveBeenCalledWith(undefined, undefined);
  });

  it("creates GeminiLLM when llm config is gemini", () => {
    createProviders({
      llm: "gemini",
      tts: "elevenlabs",
      image: "gemini",
      keys: { GOOGLE_API_KEY: "test-goog-key" },
    });

    expect(GeminiLLM).toHaveBeenCalledWith(undefined, "test-goog-key");
  });

  it("wraps KokoroTTS in AlignedTTSProvider", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "kokoro",
      image: "gemini",
    });

    expect(KokoroTTS).toHaveBeenCalled();
    expect(AlignedTTSProvider).toHaveBeenCalled();
    expect(providers.tts).toBeDefined();
  });

  it("passes kokoroVoice to KokoroTTS constructor", () => {
    createProviders({
      llm: "anthropic",
      tts: "kokoro",
      image: "gemini",
      kokoroVoice: "bf_emma",
    });

    expect(KokoroTTS).toHaveBeenCalledWith("bf_emma");
  });

  it("wraps GeminiTTS in AlignedTTSProvider", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "gemini-tts",
      image: "gemini",
      keys: { GOOGLE_API_KEY: "test-goog-key" },
    });

    expect(GeminiTTS).toHaveBeenCalled();
    expect(AlignedTTSProvider).toHaveBeenCalled();
    expect(providers.tts).toBeDefined();
  });

  it("wraps OpenAITTS in AlignedTTSProvider", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "openai-tts",
      image: "gemini",
      keys: { OPENAI_API_KEY: "test-openai-key" },
    });

    expect(OpenAITTS).toHaveBeenCalled();
    expect(AlignedTTSProvider).toHaveBeenCalled();
    expect(providers.tts).toBeDefined();
  });

  it("does not wrap ElevenLabs in AlignedTTSProvider", () => {
    vi.mocked(AlignedTTSProvider).mockClear();
    createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
    });

    expect(ElevenLabsTTS).toHaveBeenCalled();
    expect(AlignedTTSProvider).not.toHaveBeenCalled();
  });

  it("creates BundledMusic by default", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
    });

    expect(providers.music).toBeDefined();
    expect(BundledMusic).toHaveBeenCalled();
    expect(LyriaMusic).not.toHaveBeenCalled();
  });

  it("creates LyriaMusic when music config is lyria", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
      music: "lyria",
      keys: { GOOGLE_API_KEY: "test-goog-key" },
    });

    expect(providers.music).toBeDefined();
    expect(LyriaMusic).toHaveBeenCalledWith("test-goog-key");
    expect(BundledMusic).not.toHaveBeenCalled();
  });

  it("creates BundledMusic when music config is bundled", () => {
    const providers = createProviders({
      llm: "anthropic",
      tts: "elevenlabs",
      image: "gemini",
      music: "bundled",
    });

    expect(BundledMusic).toHaveBeenCalled();
    expect(LyriaMusic).not.toHaveBeenCalled();
  });
});

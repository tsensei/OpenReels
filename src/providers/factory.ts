import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type {
  ImageProvider,
  ImageProviderKey,
  LLMProviderKey,
  StockProvider,
  StockProviderKey,
  TTSProvider,
  TTSProviderKey,
} from "../schema/providers.js";
import { GeminiImage } from "./image/gemini.js";
import { OpenAIImage } from "./image/openai.js";
import { PexelsStock } from "./stock/pexels.js";
import { PixabayStock } from "./stock/pixabay.js";
import { ElevenLabsTTS } from "./tts/elevenlabs.js";
import { InworldTTS } from "./tts/inworld.js";

export interface ProviderConfig {
  llm: LLMProviderKey;
  tts: TTSProviderKey;
  image: ImageProviderKey;
  stock?: StockProviderKey;
  keys?: Record<string, string>;
}

export interface Providers {
  model: LanguageModel;
  tts: TTSProvider;
  imageGen: ImageProvider;
  stock: StockProvider;
}

/** Create a Vercel AI SDK LanguageModel from provider key and optional BYOK key */
export function createModel(provider: LLMProviderKey, apiKey?: string): LanguageModel {
  if (provider === "openai") {
    const openai = createOpenAI({ apiKey: apiKey ?? process.env["OPENAI_API_KEY"] });
    return openai("gpt-4o");
  }
  const anthropic = createAnthropic({ apiKey: apiKey ?? process.env["ANTHROPIC_API_KEY"] });
  return anthropic("claude-sonnet-4-20250514");
}

export function createProviders(config: ProviderConfig): Providers {
  const k = config.keys ?? {};

  const model = createModel(
    config.llm,
    config.llm === "openai" ? k["OPENAI_API_KEY"] : k["ANTHROPIC_API_KEY"],
  );

  const tts: TTSProvider =
    config.tts === "inworld"
      ? new InworldTTS(undefined, undefined, k["INWORLD_TTS_API_KEY"])
      : new ElevenLabsTTS(undefined, k["ELEVENLABS_API_KEY"]);

  const imageGen: ImageProvider =
    config.image === "openai"
      ? new OpenAIImage(undefined, k["OPENAI_API_KEY"])
      : new GeminiImage(undefined, k["GOOGLE_API_KEY"]);

  const stockKey = config.stock ?? "pexels";
  const stock: StockProvider =
    stockKey === "pixabay"
      ? new PixabayStock(k["PIXABAY_API_KEY"])
      : new PexelsStock(k["PEXELS_API_KEY"]);

  return { model, tts, imageGen, stock };
}

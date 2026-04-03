import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type {
  ImageProvider,
  ImageProviderKey,
  LLMProvider,
  LLMProviderKey,
  StockProvider,
  StockProviderKey,
  TTSProvider,
  TTSProviderKey,
} from "../schema/providers.js";
import { GeminiImage } from "./image/gemini.js";
import { OpenAIImage } from "./image/openai.js";
import { AnthropicLLM } from "./llm/anthropic.js";
import { OpenAILLM } from "./llm/openai.js";
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
  llm: LLMProvider;
  tts: TTSProvider;
  imageGen: ImageProvider;
  stock: StockProvider[];
}

export function createProviders(config: ProviderConfig): Providers {
  const k = config.keys ?? {};

  const llm: LLMProvider =
    config.llm === "openai"
      ? new OpenAILLM(undefined, k["OPENAI_API_KEY"])
      : new AnthropicLLM(undefined, k["ANTHROPIC_API_KEY"]);

  const tts: TTSProvider =
    config.tts === "inworld"
      ? new InworldTTS(undefined, undefined, k["INWORLD_TTS_API_KEY"])
      : new ElevenLabsTTS(undefined, k["ELEVENLABS_API_KEY"]);

  const imageGen: ImageProvider =
    config.image === "openai"
      ? new OpenAIImage(undefined, k["OPENAI_API_KEY"])
      : new GeminiImage(undefined, k["GOOGLE_API_KEY"]);

  // Build stock provider array: construct both if both keys are available
  const stock: StockProvider[] = [];
  const pexelsKey = k["PEXELS_API_KEY"] ?? process.env["PEXELS_API_KEY"];
  const pixabayKey = k["PIXABAY_API_KEY"] ?? process.env["PIXABAY_API_KEY"];

  // Primary provider first (from config or default to pexels)
  const primary = config.stock ?? "pexels";
  if (primary === "pixabay") {
    if (pixabayKey) stock.push(new PixabayStock(pixabayKey));
    if (pexelsKey) stock.push(new PexelsStock(pexelsKey));
  } else {
    if (pexelsKey) stock.push(new PexelsStock(pexelsKey));
    if (pixabayKey) stock.push(new PixabayStock(pixabayKey));
  }

  return { llm, tts, imageGen, stock };
}

/** Create an AI SDK LanguageModel instance for VLM verification */
export function createVerificationModel(
  provider: LLMProviderKey,
  model?: string,
  apiKey?: string,
): LanguageModel {
  if (provider === "openai") {
    const openai = apiKey ? createOpenAI({ apiKey }) : createOpenAI();
    return openai(model ?? "gpt-4o");
  }
  const anthropic = apiKey ? createAnthropic({ apiKey }) : createAnthropic();
  return anthropic(model ?? "claude-sonnet-4-6");
}

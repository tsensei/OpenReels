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
  stock: StockProvider;
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

  const stockKey = config.stock ?? "pexels";
  const stock: StockProvider =
    stockKey === "pixabay"
      ? new PixabayStock(k["PIXABAY_API_KEY"])
      : new PexelsStock(k["PEXELS_API_KEY"]);

  return { llm, tts, imageGen, stock };
}

import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type {
  ImageProvider,
  ImageProviderKey,
  LLMProvider,
  LLMProviderKey,
  MusicProvider,
  MusicProviderKey,
  StockProvider,
  StockProviderKey,
  TTSProvider,
  TTSProviderKey,
  VideoProvider,
  VideoProviderKey,
} from "../schema/providers.js";
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
import { WhisperAligner } from "./tts/whisper-aligner.js";
import { GeminiVideo } from "./video/gemini.js";
import { FalVideo } from "./video/fal.js";
import { BundledMusic } from "./music/bundled-adapter.js";
import { LyriaMusic } from "./music/lyria.js";

export interface ProviderConfig {
  llm: LLMProviderKey;
  tts: TTSProviderKey;
  image: ImageProviderKey;
  stock?: StockProviderKey;
  video?: VideoProviderKey;
  music?: MusicProviderKey;
  videoModel?: string;
  kokoroVoice?: string;
  keys?: Record<string, string>;
}

export interface Providers {
  llm: LLMProvider;
  tts: TTSProvider;
  imageGen: ImageProvider;
  stock: StockProvider[];
  videoProviders: VideoProvider[];
  music: MusicProvider;
}

export function createProviders(config: ProviderConfig): Providers {
  const k = config.keys ?? {};

  const llm: LLMProvider =
    config.llm === "openai"
      ? new OpenAILLM(undefined, k["OPENAI_API_KEY"])
      : config.llm === "gemini"
        ? new GeminiLLM(undefined, k["GOOGLE_API_KEY"])
        : new AnthropicLLM(undefined, k["ANTHROPIC_API_KEY"]);

  // Providers that lack native timestamps get wrapped with the alignment decorator.
  // The aligner is shared (lazy singleton) so the Whisper model loads only once.
  const aligner = new WhisperAligner();

  let tts: TTSProvider;
  switch (config.tts) {
    case "kokoro":
      tts = new AlignedTTSProvider(new KokoroTTS(config.kokoroVoice), aligner);
      break;
    case "gemini-tts":
      tts = new AlignedTTSProvider(new GeminiTTS(undefined, k["GOOGLE_API_KEY"]), aligner);
      break;
    case "openai-tts":
      tts = new AlignedTTSProvider(new OpenAITTS(undefined, k["OPENAI_API_KEY"]), aligner);
      break;
    case "inworld":
      tts = new InworldTTS(undefined, undefined, k["INWORLD_TTS_API_KEY"]);
      break;
    default:
      tts = new ElevenLabsTTS(undefined, k["ELEVENLABS_API_KEY"]);
      break;
  }

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

  // Build video provider array: construct available providers, primary first
  const videoProviders: VideoProvider[] = [];
  const googleKey = k["GOOGLE_API_KEY"] ?? process.env["GOOGLE_API_KEY"];
  const falKey = k["FAL_API_KEY"] ?? process.env["FAL_API_KEY"];
  const videoPrimary = config.video ?? (googleKey ? "gemini" : falKey ? "fal" : undefined);

  if (videoPrimary === "fal") {
    if (falKey) videoProviders.push(new FalVideo(config.videoModel, falKey));
    if (googleKey) videoProviders.push(new GeminiVideo(undefined, googleKey));
  } else if (videoPrimary === "gemini" || videoPrimary === undefined) {
    if (googleKey) videoProviders.push(new GeminiVideo(config.videoModel, googleKey));
    if (falKey) videoProviders.push(new FalVideo(undefined, falKey));
  }

  // Music provider: lyria requires GOOGLE_API_KEY, bundled is always available
  const music: MusicProvider =
    config.music === "lyria"
      ? new LyriaMusic(googleKey)
      : new BundledMusic();

  return { llm, tts, imageGen, stock, videoProviders, music };
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
  if (provider === "gemini") {
    // @ai-sdk/google looks for GOOGLE_GENERATIVE_AI_API_KEY by default,
    // but OpenReels standardizes on GOOGLE_API_KEY across all providers.
    const key = apiKey ?? process.env["GOOGLE_API_KEY"];
    const google = key ? createGoogleGenerativeAI({ apiKey: key }) : createGoogleGenerativeAI();
    return google(model ?? "gemini-2.5-flash");
  }
  const anthropic = apiKey ? createAnthropic({ apiKey }) : createAnthropic();
  return anthropic(model ?? "claude-sonnet-4-6");
}

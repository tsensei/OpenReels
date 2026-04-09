import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type {
  ImageProvider,
  ImageProviderKey,
  LLMProvider,
  LLMProviderKey,
  MusicProvider,
  MusicProviderKey,
  SearchProviderKey,
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
import { OpenAICompatibleLLM } from "./llm/openai-compatible.js";
import { OpenRouterLLM } from "./llm/openrouter.js";
import { BundledMusic } from "./music/bundled-adapter.js";
import { LyriaMusic } from "./music/lyria.js";
import { createTavilySearchTools } from "./search/tavily.js";
import { PexelsStock } from "./stock/pexels.js";
import { PixabayStock } from "./stock/pixabay.js";
import { AlignedTTSProvider } from "./tts/aligned-tts-provider.js";
import { ElevenLabsTTS } from "./tts/elevenlabs.js";
import { GeminiTTS } from "./tts/gemini.js";
import { InworldTTS } from "./tts/inworld.js";
import { KokoroTTS } from "./tts/kokoro.js";
import { OpenAITTS } from "./tts/openai.js";
import { WhisperAligner } from "./tts/whisper-aligner.js";
import { FalVideo } from "./video/fal.js";
import { GeminiVideo } from "./video/gemini.js";

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
  llmModel?: string;
  llmBaseUrl?: string;
  searchProvider?: SearchProviderKey;
}

export interface Providers {
  llm: LLMProvider;
  tts: TTSProvider;
  imageGen: ImageProvider;
  stock: StockProvider[];
  videoProviders: VideoProvider[];
  music: MusicProvider;
}

/** Providers that have native web search tools built in. */
const NATIVE_SEARCH_PROVIDERS = new Set<LLMProviderKey>(["anthropic", "openai", "gemini"]);

/**
 * Resolve which search tools to inject based on provider type and config.
 * Returns undefined when native tools should be used (no injection needed).
 */
function resolveSearchTools(
  llmProvider: LLMProviderKey,
  searchProvider: SearchProviderKey | undefined,
  keys: Record<string, string>,
): Record<string, unknown> | undefined {
  // Explicit search provider override
  if (searchProvider === "tavily") {
    return createTavilySearchTools(keys["TAVILY_API_KEY"]);
  }
  if (searchProvider === "none") {
    return {};
  }
  if (searchProvider === "native") {
    if (!NATIVE_SEARCH_PROVIDERS.has(llmProvider)) {
      throw new Error(
        `Provider "${llmProvider}" does not support native search. Use --search-provider tavily or --search-provider none.`,
      );
    }
    return undefined; // Let the subclass use its native tools
  }

  // Auto-detect: native providers use their own tools, others try Tavily
  if (NATIVE_SEARCH_PROVIDERS.has(llmProvider)) {
    return undefined;
  }
  const tavilyKey = keys["TAVILY_API_KEY"] ?? process.env["TAVILY_API_KEY"];
  if (tavilyKey) {
    return createTavilySearchTools(tavilyKey);
  }
  console.warn(
    "\nWarning: No search provider configured. TAVILY_API_KEY not set.\n" +
      "Research agent will use parametric knowledge only (no web search).\n" +
      "Get a key: https://tavily.com/ or use --search-provider none to suppress this warning.\n",
  );
  return {};
}

export function createProviders(config: ProviderConfig): Providers {
  const k = config.keys ?? {};
  const searchTools = resolveSearchTools(config.llm, config.searchProvider, k);

  let llm: LLMProvider;
  switch (config.llm) {
    case "openai":
      llm = new OpenAILLM(config.llmModel, k["OPENAI_API_KEY"], searchTools);
      break;
    case "gemini":
      llm = new GeminiLLM(config.llmModel, k["GOOGLE_API_KEY"], searchTools);
      break;
    case "openrouter":
      llm = new OpenRouterLLM(config.llmModel, k["OPENROUTER_API_KEY"], searchTools);
      break;
    case "openai-compatible": {
      const baseUrl = config.llmBaseUrl ?? process.env["OPENREELS_LLM_BASE_URL"];
      const model = config.llmModel ?? process.env["OPENREELS_LLM_MODEL"];
      if (!baseUrl) throw new Error("llmBaseUrl is required for openai-compatible provider");
      if (!model) throw new Error("llmModel is required for openai-compatible provider");
      const apiKey = k["OPENREELS_LLM_API_KEY"] ?? process.env["OPENREELS_LLM_API_KEY"];
      llm = new OpenAICompatibleLLM(baseUrl, model, apiKey, searchTools);
      break;
    }
    default:
      llm = new AnthropicLLM(config.llmModel, k["ANTHROPIC_API_KEY"], searchTools);
      break;
  }

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
    config.music === "lyria" ? new LyriaMusic(googleKey) : new BundledMusic();

  return { llm, tts, imageGen, stock, videoProviders, music };
}

/** Create an AI SDK LanguageModel instance for VLM verification */
export function createVerificationModel(
  provider: LLMProviderKey,
  model?: string,
  apiKey?: string,
): LanguageModel {
  switch (provider) {
    case "openai": {
      const openai = apiKey ? createOpenAI({ apiKey }) : createOpenAI();
      return openai(model ?? "gpt-4o");
    }
    case "gemini": {
      // @ai-sdk/google looks for GOOGLE_GENERATIVE_AI_API_KEY by default,
      // but OpenReels standardizes on GOOGLE_API_KEY across all providers.
      const key = apiKey ?? process.env["GOOGLE_API_KEY"];
      const google = key ? createGoogleGenerativeAI({ apiKey: key }) : createGoogleGenerativeAI();
      return google(model ?? "gemini-2.5-flash");
    }
    case "openrouter": {
      const openrouter = apiKey ? createOpenRouter({ apiKey }) : createOpenRouter();
      return openrouter(model ?? "anthropic/claude-sonnet-4");
    }
    case "openai-compatible": {
      const baseUrl = process.env["OPENREELS_LLM_BASE_URL"];
      if (!baseUrl) {
        // Fall back to Anthropic for verification if no base URL configured
        const anthropic = createAnthropic();
        return anthropic(model ?? "claude-sonnet-4-6");
      }
      const compat = createOpenAICompatible({
        name: "openreels-custom",
        baseURL: baseUrl,
        ...(apiKey ? { apiKey } : {}),
      });
      return compat(model ?? "gpt-4o");
    }
    default: {
      const anthropic = apiKey ? createAnthropic({ apiKey }) : createAnthropic();
      return anthropic(model ?? "claude-sonnet-4-6");
    }
  }
}

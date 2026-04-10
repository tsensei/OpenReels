import type { z } from "zod";
import type { MusicMood } from "./director-score.js";

export type LLMProviderKey = "anthropic" | "openai" | "gemini" | "openrouter" | "openai-compatible";
export type SearchProviderKey = "native" | "tavily" | "none";
export type TTSProviderKey = "elevenlabs" | "inworld" | "kokoro" | "gemini-tts" | "openai-tts";
export type ImageProviderKey = "gemini" | "openai";
export type StockProviderKey = "pexels" | "pixabay";
export type VideoProviderKey = "gemini" | "fal";
export type MusicProviderKey = "bundled" | "lyria";

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResult<T> {
  data: T;
  usage: LLMUsage;
}

export interface LLMProvider {
  readonly id: LLMProviderKey;
  generate<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
    enableWebSearch?: boolean;
  }): Promise<LLMResult<z.infer<T>>>;
}

export interface TTSProvider {
  generate(text: string): Promise<TTSResult>;
}

export interface TTSResult {
  audio: Buffer;
  words: WordTimestamp[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface ImageProvider {
  generate(prompt: string, style?: string): Promise<Buffer>;
}

export interface StockCandidate {
  url: string;
  width: number;
  height: number;
  duration?: number; // seconds, for video
  id: string; // provider-specific ID for dedup
}

export interface StockAsset {
  filePath: string;
  width: number;
  height: number;
  duration?: number; // seconds, for video
}

export interface StockProvider {
  searchVideo(query: string): Promise<StockCandidate[]>;
  searchImage(query: string): Promise<StockCandidate[]>;
  download(candidate: StockCandidate): Promise<StockAsset>;
}

export interface VideoProvider {
  readonly supportedDurations: number[];
  generate(opts: {
    sourceImage: Buffer;
    prompt: string;
    durationSeconds?: number;
    aspectRatio?: string;
    negativePrompt?: string;
  }): Promise<VideoResult>;
}

export interface VideoResult {
  filePath: string;
  durationSeconds: number;
}

export interface MusicProvider {
  generate(prompt: string, mood: MusicMood): Promise<MusicResult>;
}

export interface MusicResult {
  filePath: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

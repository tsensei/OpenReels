import type { LanguageModelUsage } from "ai";

export type LLMProviderKey = "anthropic" | "openai";
export type TTSProviderKey = "elevenlabs" | "inworld";
export type ImageProviderKey = "gemini" | "openai";
export type StockProviderKey = "pexels" | "pixabay";

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResult<T> {
  data: T;
  usage: LLMUsage;
}

/** Convert Vercel AI SDK usage format to our LLMUsage format */
export function extractUsage(aiUsage: LanguageModelUsage): LLMUsage {
  return {
    inputTokens: aiUsage.inputTokens ?? 0,
    outputTokens: aiUsage.outputTokens ?? 0,
  };
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

export interface StockAsset {
  filePath: string;
  width: number;
  height: number;
  duration?: number; // seconds, for video
}

export interface StockProvider {
  searchVideo(query: string): Promise<StockAsset | null>;
  searchImage(query: string): Promise<StockAsset | null>;
}

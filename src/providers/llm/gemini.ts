import type { GoogleGenerativeAIProvider } from "@ai-sdk/google";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { BaseLLM } from "./base.js";

export class GeminiLLM extends BaseLLM {
  readonly id = "gemini" as const;
  private provider: GoogleGenerativeAIProvider;
  private model: string;

  constructor(
    model: string = "gemini-2.5-flash",
    apiKey?: string,
    searchTools?: Record<string, unknown>,
  ) {
    super(searchTools);
    const key = apiKey ?? process.env["GOOGLE_API_KEY"];
    this.model = model;
    this.provider = key ? createGoogleGenerativeAI({ apiKey: key }) : createGoogleGenerativeAI();
  }

  protected createLanguageModel(): LanguageModel {
    return this.provider(this.model);
  }

  protected createSearchTools() {
    return { google_search: this.provider.tools.googleSearch({}) };
  }
}

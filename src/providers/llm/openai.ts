import type { OpenAIProvider } from "@ai-sdk/openai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { BaseLLM } from "./base.js";

export class OpenAILLM extends BaseLLM {
  readonly id = "openai" as const;
  private provider: OpenAIProvider;
  private model: string;

  constructor(model: string = "gpt-5.4", apiKey?: string, searchTools?: Record<string, unknown>) {
    super(searchTools);
    this.model = model;
    this.provider = apiKey ? createOpenAI({ apiKey }) : createOpenAI();
  }

  protected createLanguageModel(): LanguageModel {
    return this.provider(this.model);
  }

  protected createSearchTools() {
    return { web_search: this.provider.tools.webSearch() };
  }
}

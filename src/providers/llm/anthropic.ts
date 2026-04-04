import { createAnthropic } from "@ai-sdk/anthropic";
import type { AnthropicProvider } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { BaseLLM } from "./base.js";

export class AnthropicLLM extends BaseLLM {
  readonly id = "anthropic" as const;
  private provider: AnthropicProvider;
  private model: string;

  constructor(model: string = "claude-sonnet-4-6", apiKey?: string) {
    super();
    this.model = model;
    this.provider = apiKey ? createAnthropic({ apiKey }) : createAnthropic();
  }

  protected createLanguageModel(): LanguageModel {
    return this.provider(this.model);
  }

  protected createSearchTools() {
    return { web_search: this.provider.tools.webSearch_20250305({ maxUses: 5 }) };
  }
}

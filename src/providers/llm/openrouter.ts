import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { BaseLLM } from "./base.js";

export class OpenRouterLLM extends BaseLLM {
  readonly id = "openrouter" as const;
  private provider: ReturnType<typeof createOpenRouter>;
  private model: string;

  constructor(
    model: string = "anthropic/claude-sonnet-4",
    apiKey?: string,
    searchTools?: Record<string, unknown>,
  ) {
    super(searchTools);
    this.model = model;
    this.provider = apiKey ? createOpenRouter({ apiKey }) : createOpenRouter();
  }

  protected createLanguageModel(): LanguageModel {
    return this.provider(this.model);
  }

  protected createSearchTools() {
    // OpenRouter has no native search tools; injection handles this
    return {};
  }
}

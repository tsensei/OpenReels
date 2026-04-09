import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { BaseLLM } from "./base.js";

export class OpenAICompatibleLLM extends BaseLLM {
  readonly id = "openai-compatible" as const;
  private provider: ReturnType<typeof createOpenAICompatible>;
  private model: string;

  constructor(
    baseURL: string,
    model: string,
    apiKey?: string,
    searchTools?: Record<string, unknown>,
  ) {
    super(searchTools);
    this.model = model;
    this.provider = createOpenAICompatible({
      name: "openreels-custom",
      baseURL,
      ...(apiKey ? { apiKey } : {}),
    });
  }

  protected createLanguageModel(): LanguageModel {
    return this.provider(this.model);
  }

  protected createSearchTools() {
    // Generic endpoints have no native search tools; injection handles this
    return {};
  }
}

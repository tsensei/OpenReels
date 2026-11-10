import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { BaseLLM } from "./base.js";

// 60db chat completions provider. 60db exposes an OpenAI-compatible
// chat completions endpoint, so we wrap the AI SDK's openai-compatible
// adapter. This stays consistent with how OpenAICompatibleLLM is built
// but gives 60db a first-class --provider 60db flag.
//
// Reference: https://docs.60db.ai/api-reference/llm/chat-completion
export class SixtyDbLLM extends BaseLLM {
  readonly id = "60db" as const;
  private provider: ReturnType<typeof createOpenAICompatible>;
  private model: string;

  constructor(model?: string, apiKey?: string, searchTools?: Record<string, unknown>) {
    super(searchTools);
    const key = apiKey ?? process.env["SIXTYDB_API_KEY"];
    if (!key) throw new Error("SIXTYDB_API_KEY environment variable is required");
    const baseURL = process.env["SIXTYDB_API_BASE"] ?? "https://api.60db.ai";
    this.model = model ?? process.env["SIXTYDB_LLM_MODEL"] ?? "60db-tiny";
    this.provider = createOpenAICompatible({
      name: "sixtydb",
      baseURL: `${baseURL.replace(/\/$/, "")}/v1`,
      apiKey: key,
    });
  }

  protected createLanguageModel(): LanguageModel {
    return this.provider(this.model);
  }

  protected createSearchTools() {
    // 60db has no native web-search tool. The factory will inject Tavily
    // when configured (same path used for OpenRouter / openai-compatible).
    return {};
  }
}

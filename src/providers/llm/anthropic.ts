import { generateText, Output, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AnthropicProvider } from "@ai-sdk/anthropic";
import type { z } from "zod";
import type { LLMProvider, LLMResult, LLMUsage } from "../../schema/providers.js";

export class AnthropicLLM implements LLMProvider {
  readonly id = "anthropic" as const;
  private provider: AnthropicProvider;
  private model: string;

  constructor(model: string = "claude-sonnet-4-6", apiKey?: string) {
    this.model = model;
    this.provider = apiKey ? createAnthropic({ apiKey }) : createAnthropic();
  }

  async generate<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
    enableWebSearch?: boolean;
  }): Promise<LLMResult<z.infer<T>>> {
    // Two-pass approach when web search is enabled:
    // Pass 1: web search + free-form response (model needs freedom to call search)
    // Pass 2: structured output using search results as context
    if (opts.enableWebSearch) {
      return this.generateWithSearch(opts);
    }

    return this.generateStructured(opts);
  }

  private async generateWithSearch<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    const totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
    const languageModel = this.provider(this.model);

    // Pass 1: Let the model use web search freely
    const searchResult = await generateText({
      model: languageModel,
      system: opts.systemPrompt,
      prompt: opts.userMessage,
      tools: {
        web_search: this.provider.tools.webSearch_20250305({ maxUses: 5 }),
      },
      stopWhen: stepCountIs(5),
    });

    totalUsage.inputTokens += searchResult.usage.inputTokens ?? 0;
    totalUsage.outputTokens += searchResult.usage.outputTokens ?? 0;

    const textContent = searchResult.text;
    if (!textContent) {
      throw new Error("Web search returned no text content");
    }

    // Pass 2: Structure the search results using the schema
    const structuredResult = await generateText({
      model: languageModel,
      system:
        "You are a data extraction assistant. Structure the following research into the exact format requested. Use only the information provided.",
      prompt: `Based on this research:\n\n${textContent}\n\nStructure this into the required format.`,
      output: Output.object({ schema: opts.schema }),
    });

    totalUsage.inputTokens += structuredResult.usage.inputTokens ?? 0;
    totalUsage.outputTokens += structuredResult.usage.outputTokens ?? 0;

    if (structuredResult.output == null) {
      throw new Error("Anthropic did not return structured output from search results");
    }

    return { data: structuredResult.output as z.infer<T>, usage: totalUsage };
  }

  private async generateStructured<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    const languageModel = this.provider(this.model);

    const result = await generateText({
      model: languageModel,
      system: opts.systemPrompt,
      prompt: opts.userMessage,
      output: Output.object({ schema: opts.schema }),
    });

    if (result.output == null) {
      throw new Error("Anthropic did not return structured output");
    }

    return {
      data: result.output as z.infer<T>,
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
      },
    };
  }
}

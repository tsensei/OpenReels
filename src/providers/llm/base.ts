import { generateText, Output, stepCountIs } from "ai";
import type { LanguageModel } from "ai";
import type { z } from "zod";
import type { LLMProvider, LLMProviderKey, LLMResult, LLMUsage } from "../../schema/providers.js";

/**
 * Abstract base for LLM providers using the Vercel AI SDK.
 *
 *   ┌──────────┐   enableWebSearch?   ┌─────────────────────┐
 *   │ generate │──── true ──────────►│ generateWithSearch  │
 *   │          │                      │  Pass 1: search tool│
 *   │          │                      │  Pass 2: structure  │
 *   │          │──── false ─────────►│ generateStructured  │
 *   └──────────┘                      └─────────────────────┘
 *
 * Subclasses provide: createLanguageModel() and createSearchTools().
 */
export abstract class BaseLLM implements LLMProvider {
  abstract readonly id: LLMProviderKey;

  /** Return an AI SDK LanguageModel for the configured provider + model. */
  protected abstract createLanguageModel(): LanguageModel;

  /** Return provider-specific search tools for the two-pass web search pattern. */
  protected abstract createSearchTools(): Record<string, unknown>;

  async generate<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
    enableWebSearch?: boolean;
  }): Promise<LLMResult<z.infer<T>>> {
    if (opts.enableWebSearch) {
      return this.generateWithSearch(opts);
    }
    return this.generateStructured(opts);
  }

  /**
   * Two-pass approach:
   * Pass 1: web search + free-form response (model needs freedom to call search)
   * Pass 2: structured output using search results as context
   */
  private async generateWithSearch<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    const totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
    const languageModel = this.createLanguageModel();

    // Pass 1: Let the model use web search freely
    const searchResult = await generateText({
      model: languageModel,
      system: opts.systemPrompt,
      prompt: opts.userMessage,
      tools: this.createSearchTools() as Parameters<typeof generateText>[0]["tools"],
      stopWhen: stepCountIs(5),
    });

    totalUsage.inputTokens += searchResult.usage.inputTokens ?? 0;
    totalUsage.outputTokens += searchResult.usage.outputTokens ?? 0;

    const textContent = searchResult.text;
    if (!textContent) {
      throw new Error(`${this.id} web search returned no text content`);
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
      throw new Error(`${this.id} did not return structured output from search results`);
    }

    return { data: structuredResult.output as z.infer<T>, usage: totalUsage };
  }

  private async generateStructured<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    const languageModel = this.createLanguageModel();

    const result = await generateText({
      model: languageModel,
      system: opts.systemPrompt,
      prompt: opts.userMessage,
      output: Output.object({ schema: opts.schema }),
    });

    if (result.output == null) {
      throw new Error(`${this.id} did not return structured output`);
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

import { generateText, Output, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { OpenAIProvider } from "@ai-sdk/openai";
import type { z } from "zod";
import type { LLMProvider, LLMResult, LLMUsage } from "../../schema/providers.js";

export class OpenAILLM implements LLMProvider {
  readonly id = "openai" as const;
  private provider: OpenAIProvider;
  private model: string;

  constructor(model: string = "gpt-5.4", apiKey?: string) {
    this.model = model;
    this.provider = apiKey ? createOpenAI({ apiKey }) : createOpenAI();
  }

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
   * Two-pass approach (mirrors Anthropic provider):
   * Pass 1: Use web search tool to get grounded text
   * Pass 2: Use structured output to format the results
   */
  private async generateWithSearch<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    const totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
    const languageModel = this.provider(this.model);

    // Pass 1: Web search with provider tool
    const searchResult = await generateText({
      model: languageModel,
      system: opts.systemPrompt,
      prompt: opts.userMessage,
      tools: {
        web_search: this.provider.tools.webSearch(),
      },
      stopWhen: stepCountIs(5),
    });

    totalUsage.inputTokens += searchResult.usage.inputTokens ?? 0;
    totalUsage.outputTokens += searchResult.usage.outputTokens ?? 0;

    const searchContent = searchResult.text;
    if (!searchContent) {
      throw new Error("OpenAI web search returned no content");
    }

    // Pass 2: Structure the search results with the regular model
    const structuredResult = await generateText({
      model: languageModel,
      system: opts.systemPrompt,
      prompt: `Based on the following web research, produce a structured response.\n\n---\n${searchContent}\n---\n\nOriginal request: ${opts.userMessage}`,
      output: Output.object({ schema: opts.schema }),
    });

    totalUsage.inputTokens += structuredResult.usage.inputTokens ?? 0;
    totalUsage.outputTokens += structuredResult.usage.outputTokens ?? 0;

    if (structuredResult.output == null) {
      throw new Error("OpenAI did not return structured output from search results");
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
      throw new Error("OpenAI did not return structured output");
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

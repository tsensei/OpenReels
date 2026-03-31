import OpenAI from "openai";
import { z } from "zod";
import type { LLMProvider, LLMResult } from "../../schema/providers.js";

export class OpenAILLM implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(model: string = "gpt-4.1") {
    this.client = new OpenAI();
    this.model = model;
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
   * Pass 1: Use search model with web_search_options to get grounded text
   * Pass 2: Use regular model with function calling to structure the results
   */
  private async generateWithSearch<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    // Pass 1: Web search with a search-capable model
    const searchResponse = await this.client.chat.completions.create({
      model: "gpt-4o-search-preview",
      web_search_options: {},
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userMessage },
      ],
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

    const searchContent = searchResponse.choices[0]?.message?.content;
    if (!searchContent) {
      throw new Error("OpenAI web search returned no content");
    }

    const pass1Usage = {
      inputTokens: searchResponse.usage?.prompt_tokens ?? 0,
      outputTokens: searchResponse.usage?.completion_tokens ?? 0,
    };

    // Pass 2: Structure the search results with the regular model
    const jsonSchema = z.toJSONSchema(opts.schema);

    const structuredResponse = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        {
          role: "user",
          content: `Based on the following web research, produce a structured response.\n\n---\n${searchContent}\n---\n\nOriginal request: ${opts.userMessage}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "structured_output",
            description: "Return the structured response",
            parameters: jsonSchema as OpenAI.FunctionParameters,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "structured_output" } },
    });

    const message = structuredResponse.choices[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    if (!toolCall || toolCall.type !== "function" || !toolCall.function?.arguments) {
      throw new Error("OpenAI did not return structured output from search results");
    }

    const raw = JSON.parse(toolCall.function.arguments);
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Schema validation failed: ${JSON.stringify(parsed.error)}`);
    }

    return {
      data: parsed.data,
      usage: {
        inputTokens: pass1Usage.inputTokens + (structuredResponse.usage?.prompt_tokens ?? 0),
        outputTokens: pass1Usage.outputTokens + (structuredResponse.usage?.completion_tokens ?? 0),
      },
    };
  }

  private async generateStructured<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    const jsonSchema = z.toJSONSchema(opts.schema);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userMessage },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "structured_output",
            description: "Return the structured response",
            parameters: jsonSchema as OpenAI.FunctionParameters,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "structured_output" } },
    });

    const message = response.choices[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    if (!toolCall || toolCall.type !== "function" || !toolCall.function?.arguments) {
      throw new Error("OpenAI did not return structured output");
    }

    const raw = JSON.parse(toolCall.function.arguments);
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Schema validation failed: ${JSON.stringify(parsed.error)}`);
    }

    return {
      data: parsed.data,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}

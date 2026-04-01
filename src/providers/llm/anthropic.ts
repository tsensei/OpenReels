import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { LLMProvider, LLMResult, LLMUsage } from "../../schema/providers.js";

export class AnthropicLLM implements LLMProvider {
  readonly id = "anthropic" as const;
  private client: Anthropic;
  private model: string;

  constructor(model: string = "claude-sonnet-4-6", apiKey?: string) {
    this.client = apiKey ? new Anthropic({ apiKey }) : new Anthropic();
    this.model = model;
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

    // Pass 1: Let the model use web search freely
    const searchResponse = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: opts.systemPrompt,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        } as unknown as Anthropic.Messages.Tool,
      ],
      messages: [{ role: "user", content: opts.userMessage }],
    });

    // Extract the text response (includes search-grounded content)
    const textContent = searchResponse.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n\n");

    totalUsage.inputTokens += searchResponse.usage.input_tokens;
    totalUsage.outputTokens += searchResponse.usage.output_tokens;

    if (!textContent) {
      throw new Error("Web search returned no text content");
    }

    // Pass 2: Structure the search results using the schema
    const jsonSchema = z.toJSONSchema(opts.schema);

    const structuredResponse = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system:
        "You are a data extraction assistant. Structure the following research into the exact format requested. Use only the information provided.",
      tools: [
        {
          name: "structured_output",
          description: "Return the structured response in the required format.",
          input_schema: jsonSchema as Anthropic.Messages.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "structured_output" },
      messages: [
        {
          role: "user",
          content: `Based on this research:\n\n${textContent}\n\nStructure this into the required format.`,
        },
      ],
    });

    totalUsage.inputTokens += structuredResponse.usage.input_tokens;
    totalUsage.outputTokens += structuredResponse.usage.output_tokens;

    const toolUse = structuredResponse.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse) {
      throw new Error("Anthropic did not return structured output from search results");
    }

    const parsed = opts.schema.safeParse(toolUse.input);
    if (!parsed.success) {
      throw new Error(`Schema validation failed: ${JSON.stringify(parsed.error)}`);
    }

    return { data: parsed.data, usage: totalUsage };
  }

  private async generateStructured<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    const jsonSchema = z.toJSONSchema(opts.schema);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: opts.systemPrompt,
      tools: [
        {
          name: "structured_output",
          description: "Return the structured response in the required format.",
          input_schema: jsonSchema as Anthropic.Messages.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "structured_output" },
      messages: [{ role: "user", content: opts.userMessage }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse) {
      throw new Error("Anthropic did not return structured output");
    }

    const parsed = opts.schema.safeParse(toolUse.input);
    if (!parsed.success) {
      throw new Error(`Schema validation failed: ${JSON.stringify(parsed.error)}`);
    }

    return {
      data: parsed.data,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}

import type { LanguageModel } from "ai";
import { generateText, Output, stepCountIs } from "ai";
import type { z } from "zod";
import type { LLMProvider, LLMProviderKey, LLMResult, LLMUsage } from "../../schema/providers.js";

/**
 * Abstract base for LLM providers using the Vercel AI SDK.
 *
 *   ┌──────────┐   enableWebSearch?   ┌─────────────────────┐
 *   │ generate │──── true ──────────►│ resolve search tools │
 *   │          │                      │                     │
 *   │          │                      │  tools present?     │
 *   │          │                      │  yes → two-pass     │
 *   │          │                      │  no  → parametric   │
 *   │          │──── false ─────────►│ generateStructured  │
 *   └──────────┘                      └─────────────────────┘
 *
 * Search tool injection: the factory can inject search tools (e.g. Tavily)
 * via the constructor. If injected, they override the subclass's native tools.
 * Existing subclasses are unaffected when no tools are injected.
 */
export abstract class BaseLLM implements LLMProvider {
  abstract readonly id: LLMProviderKey;

  /** Injected search tools override native createSearchTools(). */
  protected injectedSearchTools?: Record<string, unknown>;

  constructor(searchTools?: Record<string, unknown>) {
    this.injectedSearchTools = searchTools;
  }

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
      const tools = this.injectedSearchTools ?? this.createSearchTools();
      const hasTools = Object.keys(tools).length > 0;

      if (!hasTools) {
        // No search tools available: single-pass with parametric knowledge prompt
        return this.generateStructured({
          ...opts,
          systemPrompt:
            opts.systemPrompt +
            "\n\nYou do not have access to web search. Use your training knowledge to provide the best possible research.",
        });
      }

      return this.generateWithSearch({ ...opts, tools });
    }
    return this.generateStructured(opts);
  }

  /**
   * Two-pass approach:
   * Pass 1: web search + free-form response (model needs freedom to call search)
   * Pass 2: structured output using search results as context
   *
   * If Pass 1 fails due to tool-calling errors (model doesn't support tools),
   * falls back to single-pass parametric knowledge.
   */
  private async generateWithSearch<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
    tools: Record<string, unknown>;
  }): Promise<LLMResult<z.infer<T>>> {
    const totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
    const languageModel = this.createLanguageModel();

    // Pass 1: Let the model use web search freely
    let textContent: string;
    try {
      const searchResult = await generateText({
        model: languageModel,
        system: opts.systemPrompt,
        prompt: opts.userMessage,
        tools: opts.tools as Parameters<typeof generateText>[0]["tools"],
        stopWhen: stepCountIs(5),
      });

      totalUsage.inputTokens += searchResult.usage.inputTokens ?? 0;
      totalUsage.outputTokens += searchResult.usage.outputTokens ?? 0;
      textContent = searchResult.text;
    } catch (error: unknown) {
      // Tool-calling errors: model doesn't support tools. Fall back to parametric knowledge.
      const msg = error instanceof Error ? error.message : String(error);
      const lowerMsg = msg.toLowerCase();
      const isToolError =
        lowerMsg.includes("tools_not_supported") ||
        lowerMsg.includes("tools are not supported") ||
        lowerMsg.includes("tool_use") ||
        lowerMsg.includes("tool use") ||
        lowerMsg.includes("tool_calls") ||
        lowerMsg.includes("tool calls") ||
        lowerMsg.includes("function_call") ||
        lowerMsg.includes("does not support tools") ||
        lowerMsg.includes("tooling is not supported");
      if (isToolError) {
        console.warn(
          `[${this.id}] Model does not support tool calling. Falling back to parametric knowledge.\n  Original error: ${msg}`,
        );
        return this.generateStructured({
          systemPrompt:
            opts.systemPrompt +
            "\n\nYou do not have access to web search. Use your training knowledge to provide the best possible research.",
          userMessage: opts.userMessage,
          schema: opts.schema,
        });
      }
      throw error;
    }

    if (!textContent) {
      throw new Error(`${this.id} web search returned no text content`);
    }

    // Pass 2: Structure the search results using the schema.
    // Retries up to 2 times on failure to avoid re-running Pass 1 (which burns search credits).
    const MAX_STRUCTURE_RETRIES = 2;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= MAX_STRUCTURE_RETRIES; attempt++) {
      try {
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
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_STRUCTURE_RETRIES) {
          console.warn(
            `[${this.id}] Pass 2 (structure) failed, retrying (${attempt + 1}/${MAX_STRUCTURE_RETRIES})...`,
          );
        }
      }
    }

    throw lastError!;
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

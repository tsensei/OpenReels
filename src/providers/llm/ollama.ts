import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { jsonrepair } from "jsonrepair";
import type { z } from "zod";
import type { LLMProviderKey, LLMResult } from "../../schema/providers.js";
import { BaseLLM } from "./base.js";
import { createOllama } from "ai-sdk-ollama";
import type { OllamaProvider } from "ai-sdk-ollama";

/** Error class for non-recoverable Ollama failures (skip retry, throw immediately). */
class OllamaFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaFatalError";
  }
}

export class OllamaLLM extends BaseLLM {
  readonly id: LLMProviderKey = "ollama";
  private provider: OllamaProvider;
  private model: string;

  constructor(model: string = "gemma4:e4b", baseUrl: string = "http://127.0.0.1:11434") {
    super();
    this.model = model;
    this.provider = createOllama({ baseURL: baseUrl });
  }

  protected createLanguageModel(): LanguageModel {
    return this.provider(this.model, { structuredOutputs: true }) as unknown as LanguageModel;
  }

  protected createSearchTools() {
    return {};
  }

  protected async generateStructured<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    const languageModel = this.createLanguageModel();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const userMessage =
          attempt > 0 && lastError
            ? `${opts.userMessage}\n\nYour previous JSON response was invalid: ${lastError.message}. Please output valid JSON matching the schema exactly.`
            : opts.userMessage;

        const result = await generateText({
          model: languageModel,
          system: opts.systemPrompt,
          prompt: userMessage,
          output: Output.object({ schema: opts.schema }),
        });

        if (result.output == null) {
          throw new Error("Ollama returned no structured output");
        }

        return {
          data: result.output as z.infer<T>,
          usage: {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
          },
        };
      } catch (err) {
        // Classify errors: non-recoverable ones throw immediately
        const error = err instanceof Error ? err : new Error(String(err));
        this.classifyAndThrowFatal(error);

        // Recoverable error: attempt JSON repair on the raw text
        if (attempt < maxRetries - 1) {
          const repaired = this.attemptJsonRepair(error, opts.schema);
          if (repaired) {
            console.warn(`[ollama] Attempt ${attempt + 1}: JSON repair succeeded`);
            return {
              data: repaired as z.infer<T>,
              usage: { inputTokens: 0, outputTokens: 0 },
            };
          }
        }

        lastError = error;
        console.warn(`[ollama] Attempt ${attempt + 1}/${maxRetries} failed: ${error.message}`);
      }
    }

    throw new Error(
      `Ollama structured output failed after ${maxRetries} attempts with model "${this.model}": ${lastError?.message}. ` +
        `Try a larger model (e.g., gemma4:31b) for better structured output reliability.`,
    );
  }

  /**
   * Classify errors and throw immediately for non-recoverable ones.
   * Recoverable errors (ZodError, JSON parse failures) fall through.
   */
  private classifyAndThrowFatal(error: Error): void {
    const msg = error.message.toLowerCase();

    if (msg.includes("econnrefused") || msg.includes("connect econnrefused") || msg.includes("fetch failed")) {
      throw new OllamaFatalError(
        `Ollama server not reachable. Ensure Ollama is running: ollama serve`,
      );
    }

    if (msg.includes("out of memory") || msg.includes("oom") || msg.includes("cuda out of memory")) {
      throw new OllamaFatalError(
        `Model "${this.model}" ran out of memory. Try a smaller model: ollama pull gemma4:e4b`,
      );
    }

    if (msg.includes("context length") || msg.includes("context window") || msg.includes("maximum context")) {
      throw new OllamaFatalError(
        `Prompt exceeds context window for "${this.model}". Try a model with larger context or simplify the topic.`,
      );
    }

    if (msg.includes("model") && (msg.includes("not found") || msg.includes("does not exist"))) {
      throw new OllamaFatalError(
        `Model "${this.model}" not found. Pull it first: ollama pull ${this.model}`,
      );
    }

    // Empty response is non-recoverable (retrying won't help)
    if (msg === "ollama returned no structured output") {
      throw new OllamaFatalError(
        `Model "${this.model}" returned an empty response. Try a larger model for structured output tasks.`,
      );
    }

    // Everything else (ZodError, JSON parse errors, etc.) is recoverable — fall through
  }

  /**
   * Attempt to repair malformed JSON from the error context.
   * Returns parsed data if repair succeeds, null otherwise.
   */
  private attemptJsonRepair<T extends z.ZodType>(error: Error, schema: T): z.infer<T> | null {
    try {
      // Try to extract raw text from the error or its cause
      const rawText = this.extractRawText(error);
      if (!rawText) return null;

      const repaired = jsonrepair(rawText);
      const parsed = JSON.parse(repaired);
      return schema.parse(parsed);
    } catch {
      return null;
    }
  }

  /**
   * Extract raw response text from various error shapes.
   * AI SDK errors may include the raw text in different locations.
   */
  private extractRawText(error: Error): string | null {
    // Check for text in error cause chain
    const cause = (error as any).cause;
    if (typeof cause === "object" && cause?.text) return cause.text;

    // Check for rawResponse or responseBody patterns
    if ((error as any).responseBody) return (error as any).responseBody;
    if ((error as any).rawResponse) return (error as any).rawResponse;

    // Try to extract JSON-like content from the error message itself
    const jsonMatch = error.message.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];

    return null;
  }
}

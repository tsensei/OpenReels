import { z } from "zod";
import type { LLMProvider, LLMResult } from "../../schema/providers.js";

const DEFAULT_MODEL = "llama3.2";
const DEFAULT_HOST = "http://localhost:11434";

export class OllamaLLM implements LLMProvider {
  readonly id = "ollama" as const;
  private model: string;
  private host: string;

  constructor(model: string = DEFAULT_MODEL, host: string = DEFAULT_HOST) {
    this.model = model;
    this.host = host.replace(/\/$/, "");
    console.info(
      `ℹ  Ollama mode: web search is disabled. You will be asked to provide topic context before the pipeline starts.`,
    );
  }

  async generate<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
    enableWebSearch?: boolean;
  }): Promise<LLMResult<z.infer<T>>> {
    // Ollama has no web search capability. When called with enableWebSearch=true
    // (the research agent), we return a stub so the pipeline can continue with
    // the user-provided topic brief injected via topicBrief in PipelineOptions.
    if (opts.enableWebSearch) {
      return {
        data: {
          summary: "",
          key_facts: [],
          mood: "neutral",
          sources: [],
        } as z.infer<T>,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }

    return this.generateStructured(opts);
  }

  private async generateStructured<T extends z.ZodType>(opts: {
    systemPrompt: string;
    userMessage: string;
    schema: T;
  }): Promise<LLMResult<z.infer<T>>> {
    const jsonSchema = z.toJSONSchema(opts.schema);

    const systemWithSchema =
      `${opts.systemPrompt}\n\n` +
      `You MUST respond with a single valid JSON object that conforms to this JSON Schema:\n` +
      `${JSON.stringify(jsonSchema, null, 2)}\n\n` +
      `Do not include any explanation, markdown, or text outside the JSON object.`;

    const response = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        format: "json",
        stream: false,
        messages: [
          { role: "system", content: systemWithSchema },
          { role: "user", content: opts.userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${body}`);
    }

    const raw = (await response.json()) as OllamaChatResponse;
    const content = raw.message?.content ?? "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Ollama returned non-JSON content: ${content.slice(0, 200)}`);
    }

    const result = opts.schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Ollama response failed schema validation: ${JSON.stringify(result.error)}`);
    }

    return {
      data: result.data,
      usage: {
        inputTokens: raw.prompt_eval_count ?? 0,
        outputTokens: raw.eval_count ?? 0,
      },
    };
  }
}

interface OllamaChatResponse {
  message?: { role: string; content: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

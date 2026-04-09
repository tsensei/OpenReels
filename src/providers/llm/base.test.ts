import type { LanguageModel } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LLMProviderKey } from "../../schema/providers.js";
import { BaseLLM } from "./base.js";

// Mock the ai module
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(({ schema }: { schema: unknown }) => ({ type: "object", schema })) },
  stepCountIs: vi.fn((n: number) => ({ type: "step-count", count: n })),
}));

import { generateText } from "ai";

const mockGenerateText = vi.mocked(generateText);

// Concrete test subclass
class TestLLM extends BaseLLM {
  readonly id: LLMProviderKey = "anthropic";
  private mockModel = {} as LanguageModel;
  private mockTools = { test_search: {} };

  constructor(searchTools?: Record<string, unknown>) {
    super(searchTools);
  }

  protected createLanguageModel(): LanguageModel {
    return this.mockModel;
  }

  protected createSearchTools() {
    return this.mockTools;
  }
}

// Subclass with no native tools (like OpenRouter)
class NoToolsLLM extends BaseLLM {
  readonly id: LLMProviderKey = "openrouter";
  private mockModel = {} as LanguageModel;

  constructor(searchTools?: Record<string, unknown>) {
    super(searchTools);
  }

  protected createLanguageModel(): LanguageModel {
    return this.mockModel;
  }

  protected createSearchTools() {
    return {};
  }
}

const testSchema = z.object({ result: z.string() });

describe("BaseLLM", () => {
  let llm: TestLLM;

  beforeEach(() => {
    vi.clearAllMocks();
    llm = new TestLLM();
  });

  describe("generate()", () => {
    it("routes to structured output when enableWebSearch is false", async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "structured" },
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);

      const result = await llm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
      });

      expect(result.data).toEqual({ result: "structured" });
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("routes to web search when enableWebSearch is true", async () => {
      // Pass 1: search
      mockGenerateText.mockResolvedValueOnce({
        text: "search results",
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);
      // Pass 2: structure
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "from search" },
        usage: { inputTokens: 200, outputTokens: 100 },
      } as any);

      const result = await llm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
        enableWebSearch: true,
      });

      expect(result.data).toEqual({ result: "from search" });
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });
  });

  describe("generateWithSearch()", () => {
    it("accumulates usage from both passes", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "results",
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "ok" },
        usage: { inputTokens: 200, outputTokens: 100 },
      } as any);

      const result = await llm.generate({
        systemPrompt: "sys",
        userMessage: "msg",
        schema: testSchema,
        enableWebSearch: true,
      });

      expect(result.usage.inputTokens).toBe(300);
      expect(result.usage.outputTokens).toBe(150);
    });

    it("throws when Pass 1 returns no text", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "",
        usage: { inputTokens: 0, outputTokens: 0 },
      } as any);

      await expect(
        llm.generate({
          systemPrompt: "test",
          userMessage: "test",
          schema: testSchema,
          enableWebSearch: true,
        }),
      ).rejects.toThrow("anthropic web search returned no text content");
    });

    it("throws when Pass 2 fails after all retries", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Pass 1: success
      mockGenerateText.mockResolvedValueOnce({
        text: "some results",
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);
      // Pass 2: fails 3 times (1 initial + 2 retries)
      for (let i = 0; i < 3; i++) {
        mockGenerateText.mockResolvedValueOnce({
          output: null,
          usage: { inputTokens: 100, outputTokens: 50 },
        } as any);
      }

      await expect(
        llm.generate({
          systemPrompt: "test",
          userMessage: "test",
          schema: testSchema,
          enableWebSearch: true,
        }),
      ).rejects.toThrow("anthropic did not return structured output from search results");

      // Pass 1 called once, Pass 2 called 3 times (1 + 2 retries) = 4 total
      expect(mockGenerateText).toHaveBeenCalledTimes(4);
      warnSpy.mockRestore();
    });

    it("retries Pass 2 without re-running Pass 1 (saves search credits)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Pass 1: success
      mockGenerateText.mockResolvedValueOnce({
        text: "search results",
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);
      // Pass 2 attempt 1: fails
      mockGenerateText.mockResolvedValueOnce({
        output: null,
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);
      // Pass 2 attempt 2: succeeds
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "ok" },
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);

      const result = await llm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
        enableWebSearch: true,
      });

      expect(result.data).toEqual({ result: "ok" });
      // Pass 1 once + Pass 2 twice = 3 calls (NOT 4, which would mean Pass 1 re-ran)
      expect(mockGenerateText).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Pass 2 (structure) failed"));
      warnSpy.mockRestore();
    });

    it("passes search tools to Pass 1", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "results",
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "ok" },
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);

      await llm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
        enableWebSearch: true,
      });

      const pass1Call = mockGenerateText.mock.calls[0]![0] as any;
      expect(pass1Call.tools).toEqual({ test_search: {} });
    });
  });

  describe("generateStructured()", () => {
    it("returns structured output with usage", async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "hello" },
        usage: { inputTokens: 500, outputTokens: 200 },
      } as any);

      const result = await llm.generate({
        systemPrompt: "sys",
        userMessage: "msg",
        schema: testSchema,
      });

      expect(result.data).toEqual({ result: "hello" });
      expect(result.usage).toEqual({ inputTokens: 500, outputTokens: 200 });
    });

    it("throws when output is null", async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: null,
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);

      await expect(
        llm.generate({
          systemPrompt: "test",
          userMessage: "test",
          schema: testSchema,
        }),
      ).rejects.toThrow("anthropic did not return structured output");
    });
  });

  describe("search tool injection", () => {
    it("stores injected search tools in constructor", () => {
      const injected = { custom_search: {} };
      const injectedLlm = new TestLLM(injected);
      expect((injectedLlm as any).injectedSearchTools).toBe(injected);
    });

    it("uses injected tools over native tools when web search enabled", async () => {
      const injected = { injected_search: { type: "tavily" } };
      const injectedLlm = new TestLLM(injected);

      mockGenerateText.mockResolvedValueOnce({
        text: "search results",
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "ok" },
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);

      await injectedLlm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
        enableWebSearch: true,
      });

      const pass1Call = mockGenerateText.mock.calls[0]![0] as any;
      expect(pass1Call.tools).toEqual(injected);
    });

    it("uses native tools when no injection", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "results",
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "ok" },
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);

      await llm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
        enableWebSearch: true,
      });

      const pass1Call = mockGenerateText.mock.calls[0]![0] as any;
      expect(pass1Call.tools).toEqual({ test_search: {} });
    });
  });

  describe("no-tools parametric path", () => {
    it("routes to single-pass structured output with parametric prompt when no tools", async () => {
      const noToolsLlm = new NoToolsLLM();

      mockGenerateText.mockResolvedValueOnce({
        output: { result: "from training data" },
        usage: { inputTokens: 300, outputTokens: 100 },
      } as any);

      const result = await noToolsLlm.generate({
        systemPrompt: "Research this topic",
        userMessage: "test",
        schema: testSchema,
        enableWebSearch: true,
      });

      // Should be a single call (not two-pass)
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(result.data).toEqual({ result: "from training data" });

      // The system prompt should include parametric knowledge instruction
      const call = mockGenerateText.mock.calls[0]![0] as any;
      expect(call.system).toContain("training knowledge");
    });

    it("routes to single-pass when injected tools are empty", async () => {
      const emptyToolsLlm = new TestLLM({});

      mockGenerateText.mockResolvedValueOnce({
        output: { result: "parametric" },
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);

      await emptyToolsLlm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
        enableWebSearch: true,
      });

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });
  });

  describe("tool-calling error fallback", () => {
    it("falls back to parametric when tool-calling error occurs", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Pass 1 fails with tool-calling error
      mockGenerateText.mockRejectedValueOnce(new Error("tools_not_supported by this model"));
      // Fallback structured call
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "fallback" },
        usage: { inputTokens: 200, outputTokens: 100 },
      } as any);

      const result = await llm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
        enableWebSearch: true,
      });

      expect(result.data).toEqual({ result: "fallback" });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("does not support tool calling"),
      );

      warnSpy.mockRestore();
    });

    it("rethrows non-tool-calling errors", async () => {
      mockGenerateText.mockRejectedValueOnce(new Error("network timeout"));

      await expect(
        llm.generate({
          systemPrompt: "test",
          userMessage: "test",
          schema: testSchema,
          enableWebSearch: true,
        }),
      ).rejects.toThrow("network timeout");
    });
  });
});

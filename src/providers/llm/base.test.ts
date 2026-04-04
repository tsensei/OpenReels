import { describe, expect, it, vi, beforeEach } from "vitest";
import type { LanguageModel } from "ai";
import type { LLMProviderKey } from "../../schema/providers.js";
import { BaseLLM } from "./base.js";
import { z } from "zod";

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

  protected createLanguageModel(): LanguageModel {
    return this.mockModel;
  }

  protected createSearchTools() {
    return this.mockTools;
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

    it("throws when Pass 2 returns null output", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "some results",
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);
      mockGenerateText.mockResolvedValueOnce({
        output: null,
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);

      await expect(
        llm.generate({
          systemPrompt: "test",
          userMessage: "test",
          schema: testSchema,
          enableWebSearch: true,
        }),
      ).rejects.toThrow("anthropic did not return structured output from search results");
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
});

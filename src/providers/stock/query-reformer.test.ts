import { describe, expect, it, vi } from "vitest";
import { reformulateStockQuery } from "./query-reformer.js";
import type { LLMProvider } from "../../schema/providers.js";

function mockLLM(queries: string[], reasoning = "test"): LLMProvider {
  return {
    id: "anthropic",
    generate: vi.fn().mockResolvedValue({
      data: { queries, reasoning },
      usage: { inputTokens: 100, outputTokens: 50 },
    }),
  };
}

describe("reformulateStockQuery", () => {
  it("returns reformulated queries from LLM", async () => {
    const llm = mockLLM(["rocket launch pad", "space shuttle takeoff"]);
    const result = await reformulateStockQuery(
      llm,
      "Artemis rocket launching from Kennedy Space Center",
      "Witness the historic liftoff",
    );

    expect(result.queries).toEqual(["rocket launch pad", "space shuttle takeoff"]);
    expect(result.usage.inputTokens).toBe(100);
    expect(llm.generate).toHaveBeenCalledOnce();
  });

  it("returns original query when LLM fails", async () => {
    const llm: LLMProvider = {
      id: "anthropic",
      generate: vi.fn().mockRejectedValue(new Error("Network error")),
    };

    const result = await reformulateStockQuery(llm, "test query", "test narration");

    expect(result.queries).toEqual(["test query"]);
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("handles short prompts", async () => {
    const llm = mockLLM(["cat", "kitten"]);
    const result = await reformulateStockQuery(llm, "cat", "A cute cat.");

    expect(result.queries.length).toBeGreaterThanOrEqual(1);
  });
});

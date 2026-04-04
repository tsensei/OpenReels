import { describe, expect, it, vi } from "vitest";

const mockWebSearch = vi.fn().mockReturnValue({ type: "web-search-tool" });
const mockProvider = vi.fn().mockReturnValue("language-model");
mockProvider.tools = { webSearch_20250305: mockWebSearch };

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => mockProvider),
}));

import { AnthropicLLM } from "./anthropic.js";

describe("AnthropicLLM", () => {
  it("has id 'anthropic'", () => {
    const llm = new AnthropicLLM();
    expect(llm.id).toBe("anthropic");
  });

  it("createSearchTools returns webSearch_20250305 with maxUses 5", () => {
    const llm = new AnthropicLLM();
    const tools = (llm as any).createSearchTools();
    expect(tools).toHaveProperty("web_search");
    expect(mockWebSearch).toHaveBeenCalledWith({ maxUses: 5 });
  });

  it("createLanguageModel calls provider with model", () => {
    const llm = new AnthropicLLM("claude-test-model");
    (llm as any).createLanguageModel();
    expect(mockProvider).toHaveBeenCalledWith("claude-test-model");
  });
});

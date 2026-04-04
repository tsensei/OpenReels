import { describe, expect, it, vi } from "vitest";

const mockWebSearch = vi.fn().mockReturnValue({ type: "web-search-tool" });
const mockProvider = vi.fn().mockReturnValue("language-model");
mockProvider.tools = { webSearch: mockWebSearch };

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => mockProvider),
}));

import { OpenAILLM } from "./openai.js";

describe("OpenAILLM", () => {
  it("has id 'openai'", () => {
    const llm = new OpenAILLM();
    expect(llm.id).toBe("openai");
  });

  it("createSearchTools returns webSearch", () => {
    const llm = new OpenAILLM();
    const tools = (llm as any).createSearchTools();
    expect(tools).toHaveProperty("web_search");
    expect(mockWebSearch).toHaveBeenCalled();
  });

  it("createLanguageModel calls provider with model", () => {
    const llm = new OpenAILLM("gpt-test-model");
    (llm as any).createLanguageModel();
    expect(mockProvider).toHaveBeenCalledWith("gpt-test-model");
  });
});

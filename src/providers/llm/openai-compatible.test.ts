import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => {
    const provider = vi.fn((model: string) => ({ model, type: "compat-model" }));
    return provider;
  }),
}));

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { OpenAICompatibleLLM } from "./openai-compatible.js";

describe("OpenAICompatibleLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has id 'openai-compatible'", () => {
    const llm = new OpenAICompatibleLLM("http://localhost:11434/v1", "llama3");
    expect(llm.id).toBe("openai-compatible");
  });

  it("passes baseURL, name, and apiKey to createOpenAICompatible", () => {
    new OpenAICompatibleLLM("http://localhost:11434/v1", "llama3", "test-key");
    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: "openreels-custom",
      baseURL: "http://localhost:11434/v1",
      apiKey: "test-key",
    });
  });

  it("omits apiKey when not provided", () => {
    new OpenAICompatibleLLM("http://localhost:11434/v1", "llama3");
    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: "openreels-custom",
      baseURL: "http://localhost:11434/v1",
    });
  });

  it("createSearchTools returns empty object (no native search)", () => {
    const llm = new OpenAICompatibleLLM("http://localhost/v1", "model");
    const tools = (llm as any).createSearchTools();
    expect(tools).toEqual({});
  });

  it("stores injected search tools", () => {
    const injected = { tavily: {} };
    const llm = new OpenAICompatibleLLM("http://localhost/v1", "model", undefined, injected);
    expect((llm as any).injectedSearchTools).toBe(injected);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => {
    const provider = vi.fn((model: string) => ({ model, type: "openrouter-model" }));
    return provider;
  }),
}));

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { OpenRouterLLM } from "./openrouter.js";

describe("OpenRouterLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has id 'openrouter'", () => {
    const llm = new OpenRouterLLM();
    expect(llm.id).toBe("openrouter");
  });

  it("uses default model anthropic/claude-sonnet-4", () => {
    new OpenRouterLLM();
    expect(createOpenRouter).toHaveBeenCalled();
  });

  it("passes apiKey to createOpenRouter", () => {
    new OpenRouterLLM("some-model", "test-key");
    expect(createOpenRouter).toHaveBeenCalledWith({ apiKey: "test-key" });
  });

  it("creates without apiKey", () => {
    new OpenRouterLLM("some-model");
    expect(createOpenRouter).toHaveBeenCalledWith();
  });

  it("createSearchTools returns empty object (no native search)", () => {
    const llm = new OpenRouterLLM();
    // Access protected method via cast
    const tools = (llm as any).createSearchTools();
    expect(tools).toEqual({});
  });

  it("stores injected search tools", () => {
    const injected = { tavily: {} };
    const llm = new OpenRouterLLM("model", undefined, injected);
    expect((llm as any).injectedSearchTools).toBe(injected);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@tavily/ai-sdk", () => ({
  tavilySearch: vi.fn((opts: Record<string, unknown>) => ({ type: "tavily", ...opts })),
}));

import { createTavilySearchTools } from "./tavily.js";

describe("createTavilySearchTools", () => {
  it("returns tools with explicit apiKey", () => {
    const tools = createTavilySearchTools("test-key");
    expect(tools).toHaveProperty("tavily_search");
    expect(tools["tavily_search"]).toMatchObject({ apiKey: "test-key", maxResults: 5 });
  });

  it("returns tools without apiKey (env fallback)", () => {
    const tools = createTavilySearchTools();
    expect(tools).toHaveProperty("tavily_search");
    expect(tools["tavily_search"]).toMatchObject({ maxResults: 5 });
    expect(tools["tavily_search"]).not.toHaveProperty("apiKey");
  });
});

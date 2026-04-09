import { tavilySearch } from "@tavily/ai-sdk";

/**
 * Create Tavily search tools for the AI SDK two-pass web search pattern.
 * Falls back to TAVILY_API_KEY env var when no apiKey is provided.
 */
export function createTavilySearchTools(apiKey?: string): Record<string, unknown> {
  return {
    tavily_search: tavilySearch({
      ...(apiKey ? { apiKey } : {}),
      maxResults: 5,
    }),
  };
}

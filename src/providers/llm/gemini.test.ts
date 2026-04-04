import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGoogleSearch = vi.fn().mockReturnValue({ type: "google-search-tool" });
const mockProvider = vi.fn().mockReturnValue("language-model");
mockProvider.tools = { googleSearch: mockGoogleSearch };

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => mockProvider),
}));

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { GeminiLLM } from "./gemini.js";

describe("GeminiLLM", () => {
  const origEnv = process.env["GOOGLE_API_KEY"];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (origEnv) {
      process.env["GOOGLE_API_KEY"] = origEnv;
    } else {
      delete process.env["GOOGLE_API_KEY"];
    }
  });

  it("has id 'gemini'", () => {
    const llm = new GeminiLLM(undefined, "test-key");
    expect(llm.id).toBe("gemini");
  });

  it("uses explicit apiKey when provided", () => {
    new GeminiLLM(undefined, "explicit-key");
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: "explicit-key" });
  });

  it("falls back to GOOGLE_API_KEY env var", () => {
    process.env["GOOGLE_API_KEY"] = "env-key";
    new GeminiLLM();
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: "env-key" });
  });

  it("calls createGoogleGenerativeAI without apiKey when none available", () => {
    delete process.env["GOOGLE_API_KEY"];
    new GeminiLLM();
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith();
  });

  it("createSearchTools returns googleSearch", () => {
    const llm = new GeminiLLM(undefined, "test-key");
    const tools = (llm as any).createSearchTools();
    expect(tools).toHaveProperty("google_search");
    expect(mockGoogleSearch).toHaveBeenCalledWith({});
  });

  it("createLanguageModel calls provider with model", () => {
    const llm = new GeminiLLM("gemini-test-model", "test-key");
    (llm as any).createLanguageModel();
    expect(mockProvider).toHaveBeenCalledWith("gemini-test-model");
  });

  it("defaults to gemini-2.5-flash model", () => {
    const llm = new GeminiLLM(undefined, "test-key");
    (llm as any).createLanguageModel();
    expect(mockProvider).toHaveBeenCalledWith("gemini-2.5-flash");
  });
});

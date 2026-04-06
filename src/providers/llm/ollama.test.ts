import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock ai-sdk-ollama
vi.mock("ai-sdk-ollama", () => ({
  createOllama: vi.fn(() => {
    const provider = vi.fn(() => ({}));
    return provider;
  }),
}));

// Mock ai module
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(({ schema }: { schema: unknown }) => ({ type: "object", schema })) },
}));

// Mock jsonrepair
vi.mock("jsonrepair", () => ({
  jsonrepair: vi.fn((text: string) => text),
}));

import { generateText } from "ai";
import { jsonrepair } from "jsonrepair";
import { OllamaLLM } from "./ollama.js";

const mockGenerateText = vi.mocked(generateText);
const mockJsonRepair = vi.mocked(jsonrepair);

const testSchema = z.object({ result: z.string() });

describe("OllamaLLM", () => {
  let llm: OllamaLLM;

  beforeEach(() => {
    vi.clearAllMocks();
    llm = new OllamaLLM("gemma4:e4b", "http://127.0.0.1:11434");
  });

  it("has id 'ollama'", () => {
    expect(llm.id).toBe("ollama");
  });

  it("createSearchTools returns empty object", () => {
    // Access protected method via type assertion
    const tools = (llm as any).createSearchTools();
    expect(tools).toEqual({});
  });

  describe("generateStructured()", () => {
    it("returns structured output on happy path", async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "hello" },
        usage: { inputTokens: 100, outputTokens: 50 },
      } as any);

      const result = await llm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
      });

      expect(result.data).toEqual({ result: "hello" });
      expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    });

    it("repairs malformed JSON and succeeds", async () => {
      // First call fails (Zod error with JSON-like content in message)
      const zodError = new Error('Expected string at "result"');
      (zodError as any).cause = { text: '{"result": 42}' };
      mockGenerateText.mockRejectedValueOnce(zodError);

      // jsonrepair returns valid JSON
      mockJsonRepair.mockReturnValueOnce('{"result": "42"}');

      const result = await llm.generate({
        systemPrompt: "test",
        userMessage: "test",
        schema: testSchema,
      });

      expect(result.data).toEqual({ result: "42" });
      expect(mockJsonRepair).toHaveBeenCalled();
    });

    it("retries with error feedback after repair fails", async () => {
      // First attempt: fails, repair also fails
      const firstError = new Error("bad JSON");
      mockGenerateText.mockRejectedValueOnce(firstError);
      mockJsonRepair.mockImplementationOnce(() => { throw new Error("unfixable"); });

      // Second attempt: succeeds
      mockGenerateText.mockResolvedValueOnce({
        output: { result: "ok" },
        usage: { inputTokens: 200, outputTokens: 100 },
      } as any);

      const result = await llm.generate({
        systemPrompt: "test",
        userMessage: "original message",
        schema: testSchema,
      });

      expect(result.data).toEqual({ result: "ok" });
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      // Second call should have error feedback appended
      const secondCall = mockGenerateText.mock.calls[1]![0] as any;
      expect(secondCall.prompt).toContain("Your previous JSON response was invalid");
    });

    it("throws after max retries exhausted", async () => {
      const error = new Error("always bad JSON");
      mockGenerateText.mockRejectedValue(error);
      mockJsonRepair.mockImplementation(() => { throw new Error("unfixable"); });

      await expect(
        llm.generate({ systemPrompt: "test", userMessage: "test", schema: testSchema }),
      ).rejects.toThrow(/Ollama structured output failed after 3 attempts/);
    });

    it("throws immediately on OOM (non-recoverable)", async () => {
      const oomError = new Error("CUDA out of memory");
      mockGenerateText.mockRejectedValueOnce(oomError);

      await expect(
        llm.generate({ systemPrompt: "test", userMessage: "test", schema: testSchema }),
      ).rejects.toThrow(/ran out of memory/);

      // Should NOT retry
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("throws immediately on connection refused (non-recoverable)", async () => {
      const connError = new Error("fetch failed: ECONNREFUSED");
      mockGenerateText.mockRejectedValueOnce(connError);

      await expect(
        llm.generate({ systemPrompt: "test", userMessage: "test", schema: testSchema }),
      ).rejects.toThrow(/Ollama server not reachable/);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("throws immediately on context length exceeded (non-recoverable)", async () => {
      const ctxError = new Error("context length exceeded");
      mockGenerateText.mockRejectedValueOnce(ctxError);

      await expect(
        llm.generate({ systemPrompt: "test", userMessage: "test", schema: testSchema }),
      ).rejects.toThrow(/exceeds context window/);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("throws immediately on model not found (non-recoverable)", async () => {
      const notFoundError = new Error("model 'fake-model' not found");
      mockGenerateText.mockRejectedValueOnce(notFoundError);

      const llmBad = new OllamaLLM("fake-model");
      await expect(
        llmBad.generate({ systemPrompt: "test", userMessage: "test", schema: testSchema }),
      ).rejects.toThrow(/not found.*Pull it first/);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("throws immediately on empty response (non-recoverable)", async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: null,
        usage: { inputTokens: 100, outputTokens: 0 },
      } as any);

      await expect(
        llm.generate({ systemPrompt: "test", userMessage: "test", schema: testSchema }),
      ).rejects.toThrow(/empty response/);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });
  });
});

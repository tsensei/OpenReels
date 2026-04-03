import { describe, expect, it, vi } from "vitest";
import { verifyStockResult } from "./stock-verifier.js";
import type { LanguageModel } from "ai";

// Mock AI SDK generateText
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn().mockReturnValue("mock-output-config"),
  },
}));

import { generateText } from "ai";
const mockGenerateText = vi.mocked(generateText);

// Mock fs and child_process for frame extraction
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-image")),
    unlinkSync: vi.fn(),
  };
});

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const mockModel = {} as LanguageModel;

describe("verifyStockResult", () => {
  it("returns relevant=true when VLM confirms match", async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: { relevant: true, confidence: 0.85, reason: "Real rocket launch" },
      usage: { inputTokens: 200, outputTokens: 30 },
    } as any);

    const result = await verifyStockResult(
      mockModel, "/tmp/test.jpg", "rocket launch", "A rocket launches", 0.6,
    );

    expect(result.relevant).toBe(true);
    expect(result.confidence).toBe(0.85);
    expect(result.usage.inputTokens).toBe(200);
  });

  it("returns relevant=false when VLM rejects", async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: { relevant: false, confidence: 0.12, reason: "Toy rocket on lawn" },
      usage: { inputTokens: 200, outputTokens: 30 },
    } as any);

    const result = await verifyStockResult(
      mockModel, "/tmp/test.jpg", "rocket launch", "A rocket launches", 0.6,
    );

    expect(result.relevant).toBe(false);
    expect(result.confidence).toBe(0.12);
    expect(result.reason).toBe("Toy rocket on lawn");
  });

  it("rejects when confidence is below threshold", async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: { relevant: true, confidence: 0.5, reason: "Loosely related" },
      usage: { inputTokens: 200, outputTokens: 30 },
    } as any);

    const result = await verifyStockResult(
      mockModel, "/tmp/test.jpg", "rocket launch", "A rocket launches", 0.6,
    );

    expect(result.relevant).toBe(false); // below threshold
    expect(result.confidence).toBe(0.5);
  });

  it("accepts when confidence is exactly at threshold", async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: { relevant: true, confidence: 0.6, reason: "Matches" },
      usage: { inputTokens: 200, outputTokens: 30 },
    } as any);

    const result = await verifyStockResult(
      mockModel, "/tmp/test.jpg", "rocket launch", "A rocket launches", 0.6,
    );

    expect(result.relevant).toBe(true);
  });

  it("returns not relevant when VLM returns null output", async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: null,
      usage: { inputTokens: 100, outputTokens: 10 },
    } as any);

    const result = await verifyStockResult(
      mockModel, "/tmp/test.jpg", "rocket launch", "A rocket launches", 0.6,
    );

    expect(result.relevant).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.reason).toContain("no output");
  });

  it("returns stock_unverified on VLM error", async () => {
    mockGenerateText.mockRejectedValueOnce(new Error("Network timeout"));

    const result = await verifyStockResult(
      mockModel, "/tmp/test.jpg", "rocket launch", "A rocket launches", 0.6,
    );

    expect(result.relevant).toBe(true); // stock_unverified: use it
    expect(result.confidence).toBe(-1); // sentinel
    expect(result.reason).toContain("Verification unavailable");
  });

  it("extracts frame from video files", async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: { relevant: true, confidence: 0.9, reason: "Good match" },
      usage: { inputTokens: 200, outputTokens: 30 },
    } as any);

    const result = await verifyStockResult(
      mockModel, "/tmp/test.mp4", "rocket launch", "A rocket launches", 0.6,
    );

    expect(result.relevant).toBe(true);
    // execFileSync should have been called for ffmpeg
    const { execFileSync } = await import("node:child_process");
    expect(execFileSync).toHaveBeenCalled();
  });
});

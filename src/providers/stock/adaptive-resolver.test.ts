import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    copyFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

import { resolveStockAdaptive } from "./adaptive-resolver.js";
import type { LanguageModel } from "ai";
import type {
  ImageProvider,
  LLMProvider,
  StockAsset,
  StockCandidate,
  StockProvider,
} from "../../schema/providers.js";
import type { ArchetypeConfig } from "../../schema/archetype.js";

// Mock dependencies
vi.mock("./query-reformer.js", () => ({
  reformulateStockQuery: vi.fn().mockResolvedValue({
    queries: ["reformed query 1", "reformed query 2"],
    usage: { inputTokens: 50, outputTokens: 25 },
  }),
}));

vi.mock("./stock-verifier.js", () => ({
  verifyStockResult: vi.fn(),
}));

vi.mock("../../agents/image-prompter.js", () => ({
  optimizeImagePrompt: vi.fn().mockResolvedValue({
    prompt: "optimized prompt",
    usage: { inputTokens: 80, outputTokens: 20 },
  }),
}));

import { verifyStockResult } from "./stock-verifier.js";
import { reformulateStockQuery } from "./query-reformer.js";

const mockVerify = vi.mocked(verifyStockResult);
const mockReform = vi.mocked(reformulateStockQuery);

function makeCandidate(id: string, url = "https://example.com/test"): StockCandidate {
  return { id, url, width: 1080, height: 1920 };
}

function makeAsset(id: string): StockAsset {
  return { filePath: `/tmp/cache/${id}.jpg`, width: 1080, height: 1920 };
}

function makeStockProvider(candidates: StockCandidate[]): StockProvider {
  return {
    searchVideo: vi.fn().mockResolvedValue(candidates),
    searchImage: vi.fn().mockResolvedValue(candidates),
    download: vi.fn().mockImplementation((c: StockCandidate) =>
      Promise.resolve(makeAsset(c.id)),
    ),
  };
}

const mockLLM: LLMProvider = {
  id: "anthropic",
  generate: vi.fn().mockResolvedValue({
    data: { queries: ["reform1"], reasoning: "test" },
    usage: { inputTokens: 50, outputTokens: 25 },
  }),
};

const mockImageGen: ImageProvider = {
  generate: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
};

const mockArchetype = {
  artStyle: "cinematic",
  visualColorPalette: ["#000"],
  lighting: "dramatic",
  compositionRules: "rule of thirds",
  culturalMarkers: "none",
  mood: "epic",
  antiArtifactGuidance: "no artifacts",
} as unknown as ArchetypeConfig;

const mockModel = {} as LanguageModel;

describe("resolveStockAdaptive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns verified stock on first try", async () => {
    const stock = makeStockProvider([makeCandidate("pexels-image-1")]);
    mockVerify.mockResolvedValueOnce({
      relevant: true,
      confidence: 0.85,
      reason: "Good match",
      usage: { inputTokens: 200, outputTokens: 30 },
    });

    const result = await resolveStockAdaptive(
      "stock_image", "sunset ocean", "A beautiful sunset", 0, 6, "/tmp/assets",
      {
        llm: mockLLM,
        imageGen: mockImageGen,
        stocks: [stock],
        verifyModel: mockModel,
        confidenceThreshold: 0.6,
        maxAttempts: 4,
        archetype: mockArchetype,
      },
    );

    expect(result.resolution.method).toBe("stock_verified");
    expect(result.path).toContain("scene-0-stock");
    expect(mockReform).not.toHaveBeenCalled(); // No reform needed
  });

  it("falls back to AI when all stock rejected", async () => {
    const stock = makeStockProvider([makeCandidate("pexels-image-1")]);
    mockVerify.mockResolvedValue({
      relevant: false,
      confidence: 0.12,
      reason: "Toy rocket",
      usage: { inputTokens: 200, outputTokens: 30 },
    });

    const result = await resolveStockAdaptive(
      "stock_image", "rocket launch", "A rocket launches", 0, 6, "/tmp/assets",
      {
        llm: mockLLM,
        imageGen: mockImageGen,
        stocks: [stock],
        verifyModel: mockModel,
        confidenceThreshold: 0.6,
        maxAttempts: 4,
        archetype: mockArchetype,
      },
    );

    expect(result.resolution.method).toBe("ai_fallback");
    expect(result.path).toContain("scene-0-ai.png");
    expect(mockReform).toHaveBeenCalled(); // Should have tried reformulation
  });

  it("tries second provider when first fails", async () => {
    const stock1 = makeStockProvider([makeCandidate("pexels-image-1")]);
    const stock2 = makeStockProvider([makeCandidate("pixabay-image-1")]);

    mockVerify
      .mockResolvedValueOnce({
        relevant: false, confidence: 0.1, reason: "Wrong",
        usage: { inputTokens: 200, outputTokens: 30 },
      })
      .mockResolvedValueOnce({
        relevant: true, confidence: 0.9, reason: "Perfect",
        usage: { inputTokens: 200, outputTokens: 30 },
      });

    const result = await resolveStockAdaptive(
      "stock_image", "rocket launch", "A rocket launches", 0, 6, "/tmp/assets",
      {
        llm: mockLLM,
        imageGen: mockImageGen,
        stocks: [stock1, stock2],
        verifyModel: mockModel,
        confidenceThreshold: 0.6,
        maxAttempts: 4,
        archetype: mockArchetype,
      },
    );

    expect(result.resolution.method).toBe("stock_verified");
    expect(result.resolution.attempts.length).toBe(2);
  });

  it("skips verification when verifyModel is null", async () => {
    const stock = makeStockProvider([makeCandidate("pexels-image-1")]);

    const result = await resolveStockAdaptive(
      "stock_image", "test query", "Test narration", 0, 6, "/tmp/assets",
      {
        llm: mockLLM,
        imageGen: mockImageGen,
        stocks: [stock],
        verifyModel: null,
        confidenceThreshold: 0.6,
        maxAttempts: 4,
        archetype: mockArchetype,
      },
    );

    expect(result.resolution.method).toBe("stock_unverified");
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("falls back to AI immediately when stock returns empty", async () => {
    const stock = makeStockProvider([]);

    const result = await resolveStockAdaptive(
      "stock_image", "test query", "Test narration", 0, 6, "/tmp/assets",
      {
        llm: mockLLM,
        imageGen: mockImageGen,
        stocks: [stock],
        verifyModel: mockModel,
        confidenceThreshold: 0.6,
        maxAttempts: 4,
        archetype: mockArchetype,
      },
    );

    expect(result.resolution.method).toBe("ai_fallback");
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("deduplicates seen asset IDs across queries", async () => {
    const candidate = makeCandidate("pexels-image-1");
    const stock = makeStockProvider([candidate]);
    // Provider returns same candidate for both queries

    mockVerify.mockResolvedValue({
      relevant: false, confidence: 0.2, reason: "Wrong",
      usage: { inputTokens: 200, outputTokens: 30 },
    });

    await resolveStockAdaptive(
      "stock_image", "rocket launch", "A rocket launches", 0, 6, "/tmp/assets",
      {
        llm: mockLLM,
        imageGen: mockImageGen,
        stocks: [stock],
        verifyModel: mockModel,
        confidenceThreshold: 0.6,
        maxAttempts: 4,
        archetype: mockArchetype,
      },
    );

    // Verify should only be called once for the same candidate ID,
    // not re-verified on reformulated queries
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it("respects maxAttempts cap", async () => {
    const stock1 = makeStockProvider([makeCandidate("pexels-image-1")]);
    const stock2 = makeStockProvider([makeCandidate("pixabay-image-1")]);

    mockVerify.mockResolvedValue({
      relevant: false, confidence: 0.2, reason: "Wrong",
      usage: { inputTokens: 200, outputTokens: 30 },
    });

    await resolveStockAdaptive(
      "stock_image", "test", "Test", 0, 6, "/tmp/assets",
      {
        llm: mockLLM,
        imageGen: mockImageGen,
        stocks: [stock1, stock2],
        verifyModel: mockModel,
        confidenceThreshold: 0.6,
        maxAttempts: 2, // Only 2 API calls allowed
        archetype: mockArchetype,
      },
    );

    // Should have made at most 2 stock API calls
    const totalSearchCalls =
      (stock1.searchImage as any).mock.calls.length +
      (stock2.searchImage as any).mock.calls.length;
    expect(totalSearchCalls).toBeLessThanOrEqual(2);
  });

  it("collects LLM usage from verification and reform", async () => {
    const stock = makeStockProvider([makeCandidate("pexels-image-1")]);
    mockVerify.mockResolvedValueOnce({
      relevant: true, confidence: 0.9, reason: "Good",
      usage: { inputTokens: 200, outputTokens: 30 },
    });

    const result = await resolveStockAdaptive(
      "stock_image", "test", "Test", 0, 6, "/tmp/assets",
      {
        llm: mockLLM,
        imageGen: mockImageGen,
        stocks: [stock],
        verifyModel: mockModel,
        confidenceThreshold: 0.6,
        maxAttempts: 4,
        archetype: mockArchetype,
      },
    );

    expect(result.usage).not.toBeNull();
    expect(result.usage!.inputTokens).toBeGreaterThan(0);
  });
});

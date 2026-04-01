import { describe, expect, it } from "vitest";
import type { DirectorScore } from "../schema/director-score.js";
import type { LLMUsage } from "../schema/providers.js";
import {
  computeActualLLMCost,
  estimateCost,
  formatActualCost,
  formatCostEstimate,
} from "./cost-estimator.js";

const makeScore = (scenes: Array<{ visual_type: string; script_line: string }>): DirectorScore =>
  ({
    emotional_arc: "test",
    archetype: "test",
    music_mood: "test",
    scenes: scenes.map((s) => ({
      ...s,
      visual_prompt: "prompt",
      motion: "static",
    })),
  }) as DirectorScore;

describe("estimateCost", () => {
  it("counts AI images correctly", () => {
    const score = makeScore([
      { visual_type: "ai_image", script_line: "Hello world" },
      { visual_type: "stock_video", script_line: "Second line" },
      { visual_type: "ai_image", script_line: "Third line" },
    ]);
    const result = estimateCost(score);
    expect(result.details.aiImages).toBe(2);
    expect(result.details.llmCalls).toBe(5); // 3 base + 2 image prompts
  });

  it("sums TTS characters from all script lines", () => {
    const score = makeScore([
      { visual_type: "text_card", script_line: "12345" },
      { visual_type: "ai_image", script_line: "67890" },
      { visual_type: "stock_image", script_line: "abc" },
    ]);
    const result = estimateCost(score);
    expect(result.details.ttsCharacters).toBe(13);
  });

  it("returns zero image cost when no AI images", () => {
    const score = makeScore([
      { visual_type: "text_card", script_line: "Line one" },
      { visual_type: "stock_video", script_line: "Line two" },
      { visual_type: "stock_image", script_line: "Line three" },
    ]);
    const result = estimateCost(score);
    expect(result.imageCost).toBe(0);
    expect(result.details.aiImages).toBe(0);
  });

  it("uses Inworld pricing when ttsProvider is inworld", () => {
    const score = makeScore([{ visual_type: "text_card", script_line: "Hello world" }]);
    const elevenlabs = estimateCost(score, "gemini", "elevenlabs");
    const inworld = estimateCost(score, "gemini", "inworld");
    // Inworld per-char is cheaper than ElevenLabs
    expect(inworld.ttsCost).toBeLessThan(elevenlabs.ttsCost);
    expect(inworld.ttsCost).toBeGreaterThan(0);
  });

  it("total equals sum of components", () => {
    const score = makeScore([
      { visual_type: "ai_image", script_line: "Test" },
      { visual_type: "stock_video", script_line: "Test" },
      { visual_type: "text_card", script_line: "Test" },
    ]);
    const result = estimateCost(score);
    expect(result.totalCost).toBeCloseTo(result.llmCost + result.ttsCost + result.imageCost);
  });
});

describe("formatCostEstimate", () => {
  it("includes all cost lines", () => {
    const score = makeScore([
      { visual_type: "ai_image", script_line: "Test line" },
      { visual_type: "stock_video", script_line: "Another" },
      { visual_type: "ai_image", script_line: "Third" },
    ]);
    const formatted = formatCostEstimate(estimateCost(score));
    expect(formatted).toContain("Estimated cost:");
    expect(formatted).toContain("LLM:");
    expect(formatted).toContain("TTS:");
    expect(formatted).toContain("Images:");
    expect(formatted).toContain("Stock:  free");
  });
});

describe("computeActualLLMCost", () => {
  it("computes cost from real token usage", () => {
    const usages: LLMUsage[] = [
      { inputTokens: 1000, outputTokens: 500 },
      { inputTokens: 2000, outputTokens: 1000 },
    ];
    const result = computeActualLLMCost(usages, { aiImages: 1, ttsCharacters: 100 });
    expect(result.details.totalInputTokens).toBe(3000);
    expect(result.details.totalOutputTokens).toBe(1500);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.totalCost).toBeCloseTo(result.llmCost + result.ttsCost + result.imageCost);
  });

  it("uses openai pricing when specified", () => {
    const usages: LLMUsage[] = [{ inputTokens: 1_000_000, outputTokens: 1_000_000 }];
    const anthropic = computeActualLLMCost(usages, { aiImages: 0, ttsCharacters: 0 }, "anthropic");
    const openai = computeActualLLMCost(usages, { aiImages: 0, ttsCharacters: 0 }, "openai");
    expect(anthropic.llmCost).toBeGreaterThan(openai.llmCost);
  });

  it("uses Inworld TTS pricing when specified", () => {
    const usages: LLMUsage[] = [{ inputTokens: 1000, outputTokens: 500 }];
    const elevenlabs = computeActualLLMCost(
      usages,
      { aiImages: 0, ttsCharacters: 1000 },
      "anthropic",
      "gemini",
      "elevenlabs",
    );
    const inworld = computeActualLLMCost(
      usages,
      { aiImages: 0, ttsCharacters: 1000 },
      "anthropic",
      "gemini",
      "inworld",
    );
    expect(inworld.ttsCost).toBeLessThan(elevenlabs.ttsCost);
    expect(inworld.ttsCost).toBeGreaterThan(0);
  });
});

describe("formatActualCost", () => {
  it("includes token counts and all categories", () => {
    const result = computeActualLLMCost([{ inputTokens: 5000, outputTokens: 2000 }], {
      aiImages: 2,
      ttsCharacters: 500,
    });
    const formatted = formatActualCost(result);
    expect(formatted).toContain("Actual cost:");
    expect(formatted).toContain("LLM:");
    expect(formatted).toContain("TTS:");
    expect(formatted).toContain("Images:");
  });
});

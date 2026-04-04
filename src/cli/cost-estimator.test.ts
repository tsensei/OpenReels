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
    music_mood: "epic_cinematic",
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
    expect(result.totalCost).toBeCloseTo(result.llmCost + result.ttsCost + result.imageCost + result.videoCost);
  });

  it("counts ai_video scenes for video cost and Phase 1 image cost", () => {
    const score = makeScore([
      { visual_type: "ai_video", script_line: "Rocket launch" },
      { visual_type: "ai_image", script_line: "Still image" },
      { visual_type: "ai_video", script_line: "Another video" },
    ]);
    const result = estimateCost(score);
    // 2 ai_video + 1 ai_image = 3 Phase 1 images
    expect(result.details.aiImages).toBe(3);
    expect(result.details.aiVideos).toBe(2);
    expect(result.videoCost).toBeGreaterThan(0);
    // LLM calls: 3 base + 1 ai_image prompt + 2*2 ai_video (image + motion prompt)
    expect(result.details.llmCalls).toBe(8);
  });

  it("includes per-scene cost breakdown", () => {
    const score = makeScore([
      { visual_type: "ai_video", script_line: "Video scene" },
      { visual_type: "stock_video", script_line: "Free stock" },
      { visual_type: "text_card", script_line: "Free text" },
    ]);
    const result = estimateCost(score);
    expect(result.perScene).toHaveLength(3);
    expect(result.perScene![0]!.type).toBe("ai_video");
    expect(result.perScene![0]!.cost).toBeGreaterThan(0);
    expect(result.perScene![1]!.cost).toBe(0);
    expect(result.perScene![2]!.cost).toBe(0);
  });

  it("uses fal pricing when fal video provider specified", () => {
    const score = makeScore([{ visual_type: "ai_video", script_line: "Video" }]);
    const gemini = estimateCost(score, "gemini", "elevenlabs", undefined);
    const fal = estimateCost(score, "gemini", "elevenlabs", "fal");
    expect(fal.videoCost).toBeGreaterThan(gemini.videoCost);
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

  it("includes video line when ai_video scenes present", () => {
    const score = makeScore([
      { visual_type: "ai_video", script_line: "Video scene" },
      { visual_type: "ai_image", script_line: "Image scene" },
    ]);
    const formatted = formatCostEstimate(estimateCost(score));
    expect(formatted).toContain("Video:");
    expect(formatted).toContain("1 AI videos");
    expect(formatted).toContain("Per-scene:");
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
    expect(result.totalCost).toBeCloseTo(result.llmCost + result.ttsCost + result.imageCost + result.videoCost);
  });

  it("includes video cost in actual cost computation", () => {
    const usages: LLMUsage[] = [{ inputTokens: 100, outputTokens: 50 }];
    const result = computeActualLLMCost(
      usages,
      { aiImages: 1, ttsCharacters: 0, aiVideos: 2 },
      "anthropic",
      "gemini",
      "elevenlabs",
      "gemini",
    );
    expect(result.details.aiVideos).toBe(2);
    expect(result.videoCost).toBeGreaterThan(0);
    expect(result.totalCost).toBeCloseTo(result.llmCost + result.ttsCost + result.imageCost + result.videoCost);
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

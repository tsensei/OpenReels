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
    expect(result.totalCost).toBeCloseTo(
      result.llmCost +
        result.revisionCost +
        result.ttsCost +
        result.imageCost +
        result.videoCost +
        result.musicCost,
    );
  });

  it("includes music cost when lyria provider specified", () => {
    const score = makeScore([{ visual_type: "ai_image", script_line: "Test" }]);
    const bundled = estimateCost(score, "gemini", "elevenlabs", undefined, "anthropic", "bundled");
    const lyria = estimateCost(score, "gemini", "elevenlabs", undefined, "anthropic", "lyria");
    expect(bundled.musicCost).toBe(0);
    expect(lyria.musicCost).toBeGreaterThan(0);
    expect(lyria.musicCost).toBeCloseTo(0.08, 1); // ~$0.08 for Lyria + small LLM cost
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

  it("includes revision cost with separate evaluation and revision counts", () => {
    const score = makeScore([{ visual_type: "ai_image", script_line: "Test" }]);
    // No gate activity
    const noGate = estimateCost(
      score,
      "gemini",
      "elevenlabs",
      undefined,
      "anthropic",
      "bundled",
      0,
      0,
    );
    expect(noGate.revisionCost).toBe(0);
    expect(noGate.details.gateEvaluations).toBe(0);
    expect(noGate.details.revisionRounds).toBe(0);

    // Gate only (score >= 7 on first try): 1 eval, 0 revisions
    const gateOnly = estimateCost(
      score,
      "gemini",
      "elevenlabs",
      undefined,
      "anthropic",
      "bundled",
      1,
      0,
    );
    expect(gateOnly.revisionCost).toBeGreaterThan(0);
    expect(gateOnly.details.gateEvaluations).toBe(1);
    expect(gateOnly.details.revisionRounds).toBe(0);

    // Full revision: 2 evals + 1 revision
    const fullRevision = estimateCost(
      score,
      "gemini",
      "elevenlabs",
      undefined,
      "anthropic",
      "bundled",
      2,
      1,
    );
    expect(fullRevision.revisionCost).toBeGreaterThan(gateOnly.revisionCost);
    expect(fullRevision.details.gateEvaluations).toBe(2);
    expect(fullRevision.details.revisionRounds).toBe(1);

    // Gate-only should cost less than a full revision (no director call)
    expect(gateOnly.revisionCost).toBeLessThan(fullRevision.revisionCost);
  });

  it("uses gemini LLM pricing when llmProvider is gemini", () => {
    const score = makeScore([{ visual_type: "ai_image", script_line: "Test" }]);
    const anthropic = estimateCost(score, "gemini", "elevenlabs", undefined, "anthropic");
    const geminiLlm = estimateCost(score, "gemini", "elevenlabs", undefined, "gemini");
    // Gemini is ~30x cheaper than Anthropic for LLM
    expect(geminiLlm.llmCost).toBeLessThan(anthropic.llmCost);
    expect(geminiLlm.llmCost).toBeGreaterThan(0);
  });

  it("uses zero-cost fallback for unknown providers (openrouter)", () => {
    const score = makeScore([{ visual_type: "ai_image", script_line: "Test" }]);
    const result = estimateCost(score, "gemini", "elevenlabs", undefined, "openrouter");
    expect(result.llmCost).toBe(0);
    expect(result.totalCost).toBeGreaterThan(0); // still has image/TTS cost
  });

  it("uses zero-cost fallback for unknown providers (openai-compatible)", () => {
    const score = makeScore([{ visual_type: "ai_image", script_line: "Test" }]);
    const result = estimateCost(score, "gemini", "elevenlabs", undefined, "openai-compatible");
    expect(result.llmCost).toBe(0);
  });

  it("zeroes research/director/critic LLM costs in replay mode", () => {
    const score = makeScore([
      { visual_type: "ai_image", script_line: "Test" },
      { visual_type: "stock_video", script_line: "Test two" },
    ]);
    const full = estimateCost(score);
    const replay = estimateCost(
      score, "gemini", "elevenlabs", undefined, "anthropic", "bundled", 0, 0, { replay: true },
    );
    // Replay LLM cost should only include image prompter (1 ai_image = 1 call)
    expect(replay.llmCost).toBeLessThan(full.llmCost);
    // Base LLM calls: 0 (replay) vs 3 (full)
    expect(replay.details.llmCalls).toBe(1); // only 1 image prompter call
    expect(full.details.llmCalls).toBe(4); // 3 base + 1 image prompter
    // Non-LLM costs should be identical
    expect(replay.ttsCost).toBe(full.ttsCost);
    expect(replay.imageCost).toBe(full.imageCost);
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

  it("includes music line when lyria provider specified", () => {
    const score = makeScore([{ visual_type: "ai_image", script_line: "Test" }]);
    const formatted = formatCostEstimate(
      estimateCost(score, "gemini", "elevenlabs", undefined, "anthropic", "lyria"),
    );
    expect(formatted).toContain("Music:");
    expect(formatted).toContain("Lyria AI generation");
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
    expect(result.totalCost).toBeCloseTo(
      result.llmCost + result.ttsCost + result.imageCost + result.videoCost + result.musicCost,
    );
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
    expect(result.totalCost).toBeCloseTo(
      result.llmCost + result.ttsCost + result.imageCost + result.videoCost + result.musicCost,
    );
  });

  it("includes music cost in actual cost computation", () => {
    const usages: LLMUsage[] = [{ inputTokens: 100, outputTokens: 50 }];
    const withMusic = computeActualLLMCost(
      usages,
      { aiImages: 0, ttsCharacters: 0, musicGenerated: true },
      "anthropic",
      "gemini",
      "elevenlabs",
      undefined,
      "lyria",
    );
    const withoutMusic = computeActualLLMCost(
      usages,
      { aiImages: 0, ttsCharacters: 0, musicGenerated: false },
      "anthropic",
      "gemini",
      "elevenlabs",
      undefined,
      "bundled",
    );
    expect(withMusic.musicCost).toBeGreaterThan(0);
    expect(withoutMusic.musicCost).toBe(0);
  });

  it("uses openai pricing when specified", () => {
    const usages: LLMUsage[] = [{ inputTokens: 1_000_000, outputTokens: 1_000_000 }];
    const anthropic = computeActualLLMCost(usages, { aiImages: 0, ttsCharacters: 0 }, "anthropic");
    const openai = computeActualLLMCost(usages, { aiImages: 0, ttsCharacters: 0 }, "openai");
    expect(anthropic.llmCost).toBeGreaterThan(openai.llmCost);
  });

  it("uses gemini pricing when specified", () => {
    const usages: LLMUsage[] = [{ inputTokens: 1_000_000, outputTokens: 1_000_000 }];
    const anthropic = computeActualLLMCost(usages, { aiImages: 0, ttsCharacters: 0 }, "anthropic");
    const gemini = computeActualLLMCost(usages, { aiImages: 0, ttsCharacters: 0 }, "gemini");
    expect(gemini.llmCost).toBeLessThan(anthropic.llmCost);
    expect(gemini.llmCost).toBeGreaterThan(0);
  });

  it("uses zero-cost fallback for unknown LLM provider (openrouter)", () => {
    const usages: LLMUsage[] = [{ inputTokens: 1_000_000, outputTokens: 1_000_000 }];
    const result = computeActualLLMCost(usages, { aiImages: 0, ttsCharacters: 0 }, "openrouter");
    expect(result.llmCost).toBe(0);
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

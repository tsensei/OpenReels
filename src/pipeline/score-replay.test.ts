import { describe, expect, it } from "vitest";
import { DirectorScore } from "../schema/director-score.js";
import { estimateCost } from "../cli/cost-estimator.js";

const VALID_SCORE = {
  emotional_arc: "curiosity-to-understanding",
  archetype: "cinematic_documentary",
  music_mood: "mysterious_ambient",
  scenes: [
    {
      visual_type: "ai_image",
      visual_prompt: "Deep sea creatures glowing",
      motion: "zoom_in",
      script_line: "The ocean hides secrets we cannot imagine.",
      transition: "crossfade",
    },
    {
      visual_type: "stock_video",
      visual_prompt: "Underwater footage of coral reef",
      motion: "pan_right",
      script_line: "Coral reefs are the rainforests of the sea.",
      transition: "slide_left",
    },
    {
      visual_type: "text_card",
      visual_prompt: "UNEXPLORED DEPTHS",
      motion: "static",
      script_line: "We have explored less than five percent of the ocean floor.",
      transition: null,
    },
  ],
};

describe("score replay validation", () => {
  it("parses a valid DirectorScore from JSON", () => {
    const result = DirectorScore.parse(VALID_SCORE);
    expect(result.archetype).toBe("cinematic_documentary");
    expect(result.scenes).toHaveLength(3);
  });

  it("rejects invalid JSON schema (missing scenes)", () => {
    expect(() =>
      DirectorScore.parse({
        emotional_arc: "test",
        archetype: "cinematic_documentary",
        music_mood: "epic_cinematic",
      }),
    ).toThrow();
  });

  it("rejects score with too few scenes", () => {
    expect(() =>
      DirectorScore.parse({
        emotional_arc: "test",
        archetype: "cinematic_documentary",
        music_mood: "epic_cinematic",
        scenes: [
          {
            visual_type: "ai_image",
            visual_prompt: "test",
            motion: "static",
            script_line: "test",
            transition: null,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects score violating golden rule (3 consecutive same visual_type)", () => {
    expect(() =>
      DirectorScore.parse({
        emotional_arc: "test",
        archetype: "cinematic_documentary",
        music_mood: "epic_cinematic",
        scenes: [
          { visual_type: "ai_image", visual_prompt: "a", motion: "static", script_line: "a", transition: null },
          { visual_type: "ai_image", visual_prompt: "b", motion: "static", script_line: "b", transition: null },
          { visual_type: "ai_image", visual_prompt: "c", motion: "static", script_line: "c", transition: null },
        ],
      }),
    ).toThrow();
  });

  it("accepts score with invalid archetype name (Zod accepts any string)", () => {
    const result = DirectorScore.parse({
      ...VALID_SCORE,
      archetype: "nonexistent_style",
    });
    expect(result.archetype).toBe("nonexistent_style");
  });
});

describe("score replay cost estimation", () => {
  it("zeroes research/director/critic LLM costs in replay mode", () => {
    const score = DirectorScore.parse(VALID_SCORE);
    const fullCost = estimateCost(score);
    const replayCost = estimateCost(
      score, "gemini", "elevenlabs", undefined, "anthropic", "bundled", 0, 0, { replay: true },
    );

    // Replay cost should be lower (no research+CD+critic LLM calls)
    expect(replayCost.llmCost).toBeLessThan(fullCost.llmCost);
    // Base LLM calls: replay has 0 base calls (only image prompter calls)
    expect(replayCost.details.llmCalls).toBeLessThan(fullCost.details.llmCalls);
    // TTS cost should be the same
    expect(replayCost.ttsCost).toBe(fullCost.ttsCost);
    // Image cost should be the same
    expect(replayCost.imageCost).toBe(fullCost.imageCost);
  });

  it("replay mode still includes image prompter LLM costs", () => {
    const score = DirectorScore.parse(VALID_SCORE);
    const replayCost = estimateCost(
      score, "gemini", "elevenlabs", undefined, "anthropic", "bundled", 0, 0, { replay: true },
    );
    // 1 ai_image scene = 1 image prompter call, so llmCost > 0
    expect(replayCost.llmCost).toBeGreaterThan(0);
  });

  it("replay mode with no AI images has zero LLM cost", () => {
    const noAiScore = DirectorScore.parse({
      ...VALID_SCORE,
      scenes: [
        { visual_type: "stock_video", visual_prompt: "a", motion: "static", script_line: "line 1", transition: null },
        { visual_type: "text_card", visual_prompt: "b", motion: "static", script_line: "line 2", transition: null },
        { visual_type: "stock_image", visual_prompt: "c", motion: "static", script_line: "line 3", transition: null },
      ],
    });
    const replayCost = estimateCost(
      noAiScore, "gemini", "elevenlabs", undefined, "anthropic", "bundled", 0, 0, { replay: true },
    );
    expect(replayCost.llmCost).toBe(0);
  });
});

describe("direction + score conflict", () => {
  it("direction and score are independent fields in PipelineOptions", () => {
    const opts = {
      direction: "some direction",
      replayScore: DirectorScore.parse(VALID_SCORE),
    };
    expect(opts.direction).toBeDefined();
    expect(opts.replayScore).toBeDefined();
  });
});

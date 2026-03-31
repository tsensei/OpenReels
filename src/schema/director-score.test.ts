import { describe, it, expect } from "vitest";
import { DirectorScore } from "./director-score.js";

const validScene = (type: string, overlay: string | null = null) => ({
  visual_type: type,
  visual_prompt: "test prompt",
  motion: "static",
  text_overlay: overlay,
  script_line: "Test script line.",
});

const baseScore = {
  emotional_arc: "curiosity-to-wisdom",
  archetype: "editorial_caricature",
  music_mood: "epic_cinematic",
};

describe("DirectorScore schema", () => {
  it("accepts a valid score with mixed visual types", () => {
    const result = DirectorScore.safeParse({
      ...baseScore,
      scenes: [
        validScene("text_card", "Title"),
        validScene("ai_image"),
        validScene("stock_video"),
        validScene("ai_image"),
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 3 scenes", () => {
    const result = DirectorScore.safeParse({
      ...baseScore,
      scenes: [validScene("ai_image"), validScene("stock_image")],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 scenes", () => {
    const scenes = Array.from({ length: 11 }, (_, i) =>
      validScene(i % 2 === 0 ? "ai_image" : "stock_video"),
    );
    const result = DirectorScore.safeParse({ ...baseScore, scenes });
    expect(result.success).toBe(false);
  });

  it("rejects 3 consecutive scenes of the same visual type (golden rule)", () => {
    const result = DirectorScore.safeParse({
      ...baseScore,
      scenes: [
        validScene("ai_image"),
        validScene("ai_image"),
        validScene("ai_image"),
        validScene("stock_video"),
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Golden rule");
    }
  });

  it("allows 2 consecutive scenes of the same type", () => {
    const result = DirectorScore.safeParse({
      ...baseScore,
      scenes: [
        validScene("ai_image"),
        validScene("ai_image"),
        validScene("stock_video"),
        validScene("text_card", "Text"),
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects text_card without text_overlay", () => {
    const result = DirectorScore.safeParse({
      ...baseScore,
      scenes: [
        validScene("text_card", null), // missing overlay
        validScene("ai_image"),
        validScene("stock_video"),
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("text_card");
    }
  });

  it("accepts text_card with text_overlay", () => {
    const result = DirectorScore.safeParse({
      ...baseScore,
      scenes: [
        validScene("text_card", "HEADLINE"),
        validScene("ai_image"),
        validScene("stock_video"),
      ],
    });
    expect(result.success).toBe(true);
  });
});

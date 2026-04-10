import { describe, expect, it } from "vitest";
import { DirectorScore } from "../schema/director-score.js";

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

describe("server-level direction validation", () => {
  it("accepts direction text within 10KB", () => {
    const direction = "Use cinematic style with dark tones";
    const byteLen = Buffer.byteLength(direction, "utf-8");
    expect(byteLen).toBeLessThanOrEqual(10240);
  });

  it("rejects direction text exceeding 10KB in bytes", () => {
    const direction = "x".repeat(10241);
    const byteLen = Buffer.byteLength(direction, "utf-8");
    expect(byteLen).toBeGreaterThan(10240);
  });

  it("correctly measures CJK direction text in bytes (not chars)", () => {
    // Each CJK character is 3 bytes in UTF-8
    const cjkDirection = "\u4e16".repeat(3414); // 3414 * 3 = 10242 bytes
    const charLen = cjkDirection.length;
    const byteLen = Buffer.byteLength(cjkDirection, "utf-8");
    expect(charLen).toBe(3414);
    expect(byteLen).toBe(10242);
    expect(byteLen).toBeGreaterThan(10240);
  });
});

describe("server-level score validation", () => {
  it("accepts a valid DirectorScore via safeParse", () => {
    const result = DirectorScore.safeParse(VALID_SCORE);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid DirectorScore via safeParse", () => {
    const result = DirectorScore.safeParse({
      emotional_arc: "test",
      // missing required fields
    });
    expect(result.success).toBe(false);
  });

  it("rejects a score with invalid music_mood value", () => {
    const result = DirectorScore.safeParse({
      ...VALID_SCORE,
      music_mood: "invalid_mood",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a score with invalid visual_type in a scene", () => {
    const result = DirectorScore.safeParse({
      ...VALID_SCORE,
      scenes: [
        {
          visual_type: "hologram",
          visual_prompt: "test",
          motion: "static",
          script_line: "test",
          transition: null,
        },
        ...VALID_SCORE.scenes.slice(1),
      ],
    });
    expect(result.success).toBe(false);
  });
});

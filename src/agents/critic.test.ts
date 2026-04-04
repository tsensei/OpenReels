import { describe, expect, it, vi } from "vitest";
import type { DirectorScore } from "../schema/director-score.js";
import type { LLMProvider } from "../schema/providers.js";
import { evaluate } from "./critic.js";

const baseScore: DirectorScore = {
  emotional_arc: "curiosity-to-wisdom",
  archetype: "infographic",
  music_mood: "epic_cinematic",
  scenes: [
    { visual_type: "text_card", visual_prompt: "Title", motion: "static", script_line: "Hook." },
    { visual_type: "ai_image", visual_prompt: "Img", motion: "zoom_in", script_line: "Body." },
    { visual_type: "stock_video", visual_prompt: "Vid", motion: "static", script_line: "End." },
  ],
};

function mockLLM(): LLMProvider & { lastUserMessage: string } {
  const mock = {
    id: "anthropic" as const,
    lastUserMessage: "",
    generate: vi.fn(async ({ userMessage }: { userMessage: string }) => {
      mock.lastUserMessage = userMessage;
      return {
        data: {
          score: 8,
          strengths: ["good"],
          weaknesses: [],
          revision_needed: false,
          revision_instructions: null,
          weakest_scene_index: null,
        },
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    }),
  };
  return mock;
}

describe("evaluate pacing tier derivation", () => {
  it("derives fast tier from infographic archetype", async () => {
    const llm = mockLLM();
    await evaluate(llm, baseScore, "test topic");
    expect(llm.lastUserMessage).toContain("**fast** pacing");
    expect(llm.lastUserMessage).toContain("8-12 scenes");
  });

  it("derives cinematic tier from warm_narrative archetype", async () => {
    const llm = mockLLM();
    const score = { ...baseScore, archetype: "warm_narrative" };
    await evaluate(llm, score, "test topic");
    expect(llm.lastUserMessage).toContain("**cinematic** pacing");
    expect(llm.lastUserMessage).toContain("5-8 scenes");
  });

  it("explicit pacing override wins over archetype", async () => {
    const llm = mockLLM();
    // infographic is fast, but override says cinematic
    await evaluate(llm, baseScore, "test topic", "cinematic");
    expect(llm.lastUserMessage).toContain("**cinematic** pacing");
    expect(llm.lastUserMessage).not.toContain("**fast**");
  });

  it("falls back to moderate for unknown archetype", async () => {
    const llm = mockLLM();
    const score = { ...baseScore, archetype: "nonexistent_archetype" };
    await evaluate(llm, score, "test topic");
    expect(llm.lastUserMessage).toContain("**moderate** pacing");
  });

  it("ignores invalid pacing override and uses archetype", async () => {
    const llm = mockLLM();
    await evaluate(llm, baseScore, "test topic", "turbo");
    // "turbo" is not valid, falls through to archetype (infographic = fast)
    expect(llm.lastUserMessage).toContain("**fast** pacing");
  });

  it("returns critique data from LLM response", async () => {
    const llm = mockLLM();
    const result = await evaluate(llm, baseScore, "test topic");
    expect(result.data.score).toBe(8);
    expect(result.data.revision_needed).toBe(false);
    expect(result.usage.inputTokens).toBe(100);
  });
});

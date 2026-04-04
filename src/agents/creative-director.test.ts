import { describe, expect, it } from "vitest";
import { buildPacingInstruction, PACING_CONFIG } from "./creative-director.js";

describe("buildPacingInstruction", () => {
  // Path 1: explicit archetype — derive tier from config
  it("returns single tier instruction for known archetype (fast)", () => {
    const result = buildPacingInstruction("infographic");
    expect(result).toContain("fast");
    expect(result).toContain("8-12");
    expect(result).not.toContain("After choosing your archetype");
  });

  it("returns single tier instruction for known archetype (moderate)", () => {
    const result = buildPacingInstruction("editorial_caricature");
    expect(result).toContain("moderate");
    expect(result).toContain("7-10");
  });

  it("returns single tier instruction for known archetype (cinematic)", () => {
    const result = buildPacingInstruction("cinematic_documentary");
    expect(result).toContain("cinematic");
    expect(result).toContain("5-8");
  });

  // Path 2: no archetype — full tier lookup table
  it("returns full tier lookup table when no archetype specified", () => {
    const result = buildPacingInstruction();
    expect(result).toContain("After choosing your archetype");
    expect(result).toContain("infographic");
    expect(result).toContain("cinematic_documentary");
    expect(result).toContain("warm_editorial");
    // All three tiers present
    expect(result).toContain("fast");
    expect(result).toContain("moderate");
    expect(result).toContain("cinematic");
  });

  it("returns full tier lookup table for unknown archetype", () => {
    const result = buildPacingInstruction("nonexistent_archetype");
    expect(result).toContain("After choosing your archetype");
  });

  // Path 3: --pacing override wins
  it("uses explicit pacing override regardless of archetype", () => {
    const result = buildPacingInstruction("cinematic_documentary", "fast");
    expect(result).toContain("fast");
    expect(result).toContain("8-12");
    expect(result).not.toContain("cinematic");
  });

  it("uses explicit pacing override without archetype", () => {
    const result = buildPacingInstruction(undefined, "cinematic");
    expect(result).toContain("cinematic");
    expect(result).toContain("5-8");
    expect(result).not.toContain("After choosing your archetype");
  });

  it("ignores invalid pacing override and falls through", () => {
    const result = buildPacingInstruction("infographic", "turbo");
    // Invalid pacing is not in PACING_CONFIG, so falls through to archetype
    expect(result).toContain("fast");
    expect(result).toContain("8-12");
  });

  // Word budget inclusion
  it("includes word budget in tier instruction", () => {
    const result = buildPacingInstruction("infographic");
    expect(result).toContain("90-120");
    expect(result).toContain("8-12 words");
  });

  it("includes word budget for moderate tier", () => {
    const result = buildPacingInstruction("warm_editorial");
    expect(result).toContain("100-140");
    expect(result).toContain("10-16");
  });
});

describe("PACING_CONFIG", () => {
  it("has valid config for all three tiers", () => {
    expect(PACING_CONFIG.fast).toBeDefined();
    expect(PACING_CONFIG.moderate).toBeDefined();
    expect(PACING_CONFIG.cinematic).toBeDefined();
  });

  it("fast tier has fewer max scenes than schema allows", () => {
    expect(PACING_CONFIG.fast.max).toBeLessThanOrEqual(16);
    expect(PACING_CONFIG.fast.min).toBeGreaterThanOrEqual(3);
  });

  it("word budget math closes for fast tier typical case", () => {
    // Typical fast tier: hook(10) + N middle scenes at avg words + CTA(10)
    // With 10 scenes (typical): 10 + 8*10 + 10 = 100 words — within 90-120 budget
    const middleScenes = PACING_CONFIG.fast.max - 2; // minus hook + CTA
    const avgWordsPerScene = 10; // middle of 8-12 range
    const hookCta = 20; // 10 words each
    const totalBudgetMax = parseInt(PACING_CONFIG.fast.totalWords.split("-")[1]!);
    expect(middleScenes * avgWordsPerScene + hookCta).toBeLessThanOrEqual(totalBudgetMax);
  });

  it("cinematic tier has lower scene count than fast", () => {
    expect(PACING_CONFIG.cinematic.max).toBeLessThan(PACING_CONFIG.fast.max);
  });
});

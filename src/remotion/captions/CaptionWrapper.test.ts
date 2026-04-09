import { describe, expect, it } from "vitest";
import type { WordTimestamp } from "../../schema/providers";
import { computeWordStates, getWordState } from "./caption-utils";

const words: WordTimestamp[] = [
  { word: "Hello", start: 1.0, end: 1.5 },
  { word: "beautiful", start: 1.6, end: 2.0 },
  { word: "world", start: 2.1, end: 2.5 },
  { word: "this", start: 2.6, end: 3.0 },
  { word: "is", start: 3.1, end: 3.3 },
];

// Identity spring: returns 1 for any input (refactor commit behavior)
const identitySpring = () => 1;

describe("getWordState", () => {
  it("returns unspoken before word starts", () => {
    expect(getWordState(words[0]!, 0.5)).toBe("unspoken");
  });

  it("returns active during word", () => {
    expect(getWordState(words[0]!, 1.2)).toBe("active");
  });

  it("returns spoken after word ends", () => {
    expect(getWordState(words[0]!, 1.6)).toBe("spoken");
  });

  it("returns active at exact start time", () => {
    expect(getWordState(words[0]!, 1.0)).toBe("active");
  });

  it("returns spoken at exact end time", () => {
    expect(getWordState(words[0]!, 1.5)).toBe("spoken");
  });

  it("handles zero-duration word (start === end)", () => {
    const zeroDuration = { word: "x", start: 1.0, end: 1.0 };
    expect(getWordState(zeroDuration, 0.9)).toBe("unspoken");
    expect(getWordState(zeroDuration, 1.0)).toBe("spoken"); // start === end, not < end
  });
});

describe("computeWordStates", () => {
  it("computes correct states for a chunk", () => {
    const chunk = words.slice(0, 3); // Hello, beautiful, world
    const result = computeWordStates(chunk, 0, 1.8, identitySpring);

    expect(result[0]!.state).toBe("spoken"); // Hello: 1.8 >= 1.5
    expect(result[1]!.state).toBe("active"); // beautiful: 1.6 <= 1.8 < 2.0
    expect(result[2]!.state).toBe("unspoken"); // world: 1.8 < 2.1
  });

  it("sets springProgress to 0 for unspoken words", () => {
    const chunk = words.slice(0, 3);
    const result = computeWordStates(chunk, 0, 0.5, identitySpring);
    // All unspoken at time 0.5
    expect(result[0]!.springProgress).toBe(0);
    expect(result[1]!.springProgress).toBe(0);
    expect(result[2]!.springProgress).toBe(0);
  });

  it("calls springFn for active and spoken words", () => {
    const chunk = words.slice(0, 3);
    const mockSpring = (idx: number) => idx === 0 ? 0.7 : 1.0;
    const result = computeWordStates(chunk, 0, 1.8, mockSpring);

    expect(result[0]!.springProgress).toBe(0.7); // spoken, springFn(0) = 0.7
    expect(result[1]!.springProgress).toBe(1.0); // active, springFn(1) = 1.0
    expect(result[2]!.springProgress).toBe(0); // unspoken, always 0
  });

  it("preserves global indices with chunkStart offset", () => {
    const chunk = words.slice(2, 5); // world, this, is
    const result = computeWordStates(chunk, 2, 2.8, identitySpring);

    expect(result[0]!.globalIndex).toBe(2);
    expect(result[1]!.globalIndex).toBe(3);
    expect(result[2]!.globalIndex).toBe(4);
  });

  it("marks emphasis words from emphasisIndices set", () => {
    const chunk = words.slice(0, 3);
    const emphasisSet = new Set([1]); // "beautiful" is emphasis
    const result = computeWordStates(chunk, 0, 1.2, identitySpring, emphasisSet);

    expect(result[0]!.emphasis).toBe(false);
    expect(result[1]!.emphasis).toBe(true);
    expect(result[2]!.emphasis).toBe(false);
  });

  it("handles undefined emphasisIndices gracefully", () => {
    const chunk = words.slice(0, 2);
    const result = computeWordStates(chunk, 0, 1.2, identitySpring, undefined);
    expect(result[0]!.emphasis).toBe(false);
    expect(result[1]!.emphasis).toBe(false);
  });

  it("handles empty chunk", () => {
    const result = computeWordStates([], 0, 1.0, identitySpring);
    expect(result).toEqual([]);
  });

  it("handles single word", () => {
    const result = computeWordStates([words[0]!], 0, 1.2, identitySpring);
    expect(result).toHaveLength(1);
    expect(result[0]!.state).toBe("active");
    expect(result[0]!.globalIndex).toBe(0);
  });

  it("handles simultaneous timestamps (two words with same start)", () => {
    const simultaneous = [
      { word: "A", start: 1.0, end: 1.2 },
      { word: "B", start: 1.0, end: 1.3 },
    ];
    const result = computeWordStates(simultaneous, 0, 1.1, identitySpring);
    expect(result[0]!.state).toBe("active");
    expect(result[1]!.state).toBe("active");
  });

  it("handles backwards timestamps defensively", () => {
    const backwards = [
      { word: "A", start: 1.5, end: 1.8 },
      { word: "B", start: 1.0, end: 1.3 }, // starts before A
    ];
    const result = computeWordStates(backwards, 0, 1.2, identitySpring);
    expect(result[0]!.state).toBe("unspoken"); // 1.2 < 1.5
    expect(result[1]!.state).toBe("active"); // 1.0 <= 1.2 < 1.3
  });
});

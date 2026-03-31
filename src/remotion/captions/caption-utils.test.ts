import { describe, it, expect } from "vitest";
import { findActiveWordIndex, getWordWindow, getWordChunk } from "./caption-utils";
import type { WordTimestamp } from "../../schema/providers";

const words: WordTimestamp[] = [
  { word: "Hello", start: 1.0, end: 1.5 },
  { word: "world", start: 1.6, end: 2.0 },
  { word: "this", start: 2.5, end: 2.8 },
  { word: "is", start: 2.9, end: 3.1 },
  { word: "a", start: 3.2, end: 3.3 },
  { word: "test", start: 3.4, end: 3.8 },
];

describe("findActiveWordIndex", () => {
  it("returns the index of the word currently being spoken", () => {
    expect(findActiveWordIndex(words, 1.2)).toBe(0);
    expect(findActiveWordIndex(words, 1.7)).toBe(1);
    expect(findActiveWordIndex(words, 3.5)).toBe(5);
  });

  it("holds the last spoken word during gaps", () => {
    // Gap between word 1 (end 2.0) and word 2 (start 2.5)
    expect(findActiveWordIndex(words, 2.2)).toBe(1);
  });

  it("returns -1 before any word has been spoken", () => {
    expect(findActiveWordIndex(words, 0.5)).toBe(-1);
  });

  it("returns -1 for an empty words array", () => {
    expect(findActiveWordIndex([], 1.0)).toBe(-1);
  });

  it("holds the last word after all speech ends", () => {
    expect(findActiveWordIndex(words, 10.0)).toBe(5);
  });
});

describe("getWordWindow", () => {
  it("returns a window centered on the active word", () => {
    const { visible, startIndex } = getWordWindow(words, 3, 2);
    expect(startIndex).toBe(1);
    expect(visible.length).toBe(5);
    expect(visible[0]?.word).toBe("world");
    expect(visible[2]?.word).toBe("is");
  });

  it("clamps to the start of the array", () => {
    const { visible, startIndex } = getWordWindow(words, 0, 2);
    expect(startIndex).toBe(0);
    expect(visible[0]?.word).toBe("Hello");
  });

  it("clamps to the end of the array", () => {
    const { visible, startIndex } = getWordWindow(words, 5, 2);
    expect(startIndex).toBe(3);
    expect(visible[visible.length - 1]?.word).toBe("test");
  });
});

describe("getWordChunk", () => {
  it("returns the correct chunk for mid-stream time", () => {
    const { chunk, chunkStart } = getWordChunk(words, 1.2, 3);
    expect(chunkStart).toBe(0);
    expect(chunk.length).toBe(3);
    expect(chunk[0]?.word).toBe("Hello");
  });

  it("advances to the next chunk when previous chunk is exhausted", () => {
    const { chunk, chunkStart } = getWordChunk(words, 3.5, 3);
    expect(chunkStart).toBe(3);
    expect(chunk[0]?.word).toBe("is");
  });

  it("handles the partial last chunk", () => {
    // 6 words with chunkSize 4: chunk 0 = [0..3], chunk 1 = [4..5]
    const { chunk, chunkStart } = getWordChunk(words, 3.5, 4);
    expect(chunkStart).toBe(4);
    expect(chunk.length).toBe(2);
    expect(chunk[0]?.word).toBe("a");
    expect(chunk[1]?.word).toBe("test");
  });

  it("returns the first chunk for time before any speech", () => {
    const { chunkStart } = getWordChunk(words, 0.1, 3);
    expect(chunkStart).toBe(0);
  });
});

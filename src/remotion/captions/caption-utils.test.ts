import { describe, expect, it } from "vitest";
import type { WordTimestamp } from "../../schema/providers";
import { getWordChunk } from "./caption-utils";

const words: WordTimestamp[] = [
  { word: "Hello", start: 1.0, end: 1.5 },
  { word: "world", start: 1.6, end: 2.0 },
  { word: "this", start: 2.5, end: 2.8 },
  { word: "is", start: 2.9, end: 3.1 },
  { word: "a", start: 3.2, end: 3.3 },
  { word: "test", start: 3.4, end: 3.8 },
];

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

  it("uses default lingerS of 0.3 when not specified", () => {
    // Last word ends at 3.8, so chunk should still be active at 3.8 + 0.29
    const { chunkStart } = getWordChunk(words, 4.09, 3);
    expect(chunkStart).toBe(3); // still on last chunk
  });

  it("respects custom lingerS parameter", () => {
    // With lingerS=0.05, chunk advances much sooner
    // Last word of chunk 0 (chunkSize=3) ends at 2.8
    // At time 2.86 (> 2.8 + 0.05), should advance to chunk 1
    const { chunkStart } = getWordChunk(words, 2.86, 3, 0.05);
    expect(chunkStart).toBe(3);
  });

  it("handles lingerS=0 (instant advance)", () => {
    // At exactly the last word's end time + epsilon, should advance
    const { chunkStart } = getWordChunk(words, 2.81, 3, 0);
    expect(chunkStart).toBe(3);
  });

  it("handles very large lingerS (chunk lingers forever)", () => {
    // lingerS=100 means first chunk stays active way past its words
    const { chunkStart } = getWordChunk(words, 50, 3, 100);
    expect(chunkStart).toBe(0); // still on first chunk
  });

  it("handles empty words array", () => {
    const { chunk, chunkStart } = getWordChunk([], 1.0, 3);
    expect(chunkStart).toBe(0);
    expect(chunk).toEqual([]);
  });
});

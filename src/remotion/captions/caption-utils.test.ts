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

  it("handles very large lingerS but advances when next chunk has started", () => {
    // lingerS=100 but words are continuous, so linger is cut short
    // At time 50, all words are past. Last chunk stays.
    const { chunkStart } = getWordChunk(words, 50, 3, 100);
    expect(chunkStart).toBe(3); // last chunk (words are all spoken, no next chunk to advance to)
  });

  it("lingers on last chunk indefinitely when no next chunk exists", () => {
    // The very last chunk has no "next chunk" to check, so linger applies fully
    const { chunkStart } = getWordChunk(words, 4.0, 3, 100);
    expect(chunkStart).toBe(3); // stays on last chunk
  });

  it("handles empty words array", () => {
    const { chunk, chunkStart } = getWordChunk([], 1.0, 3);
    expect(chunkStart).toBe(0);
    expect(chunk).toEqual([]);
  });

  it("advances to next chunk when next chunk's first word has started, even during linger", () => {
    // Regression: linger window hid the first word of the next chunk.
    // Words are continuous (no gap between chunks), lingerS=0.5.
    // At time 1.05 (chunk 1's "know" has started at 1.0), chunk 0 should
    // NOT linger. It should advance so "know" can be shown as "active".
    const continuous: WordTimestamp[] = [
      { word: "Did", start: 0.1, end: 0.3 },
      { word: "you", start: 0.3, end: 0.5 },
      { word: "know", start: 0.5, end: 0.8 },
      { word: "we", start: 0.8, end: 1.0 },
      { word: "know", start: 1.0, end: 1.3 },
      { word: "more", start: 1.3, end: 1.6 },
      { word: "about", start: 1.6, end: 1.9 },
      { word: "Mars", start: 1.9, end: 2.2 },
    ];
    // At time 1.05: chunk 0 last word "we" ended at 1.0, linger would last to 1.5.
    // But chunk 1 first word "know" started at 1.0. Should advance.
    const { chunkStart, chunk } = getWordChunk(continuous, 1.05, 4, 0.5);
    expect(chunkStart).toBe(4);
    expect(chunk[0]?.word).toBe("know");
  });

  it("still lingers when there is a gap before next chunk starts", () => {
    // When there IS a genuine gap between chunks, linger should work.
    const gapped: WordTimestamp[] = [
      { word: "Hello", start: 0.0, end: 0.3 },
      { word: "world", start: 0.3, end: 0.6 },
      // 0.9s gap here
      { word: "Next", start: 1.5, end: 1.8 },
      { word: "chunk", start: 1.8, end: 2.0 },
    ];
    // At time 0.8: chunk 0 last word "world" ended at 0.6, linger to 0.9.
    // Next chunk starts at 1.5 (not started yet). Should stay on chunk 0.
    const { chunkStart } = getWordChunk(gapped, 0.8, 2, 0.3);
    expect(chunkStart).toBe(0);
  });

  it("returns empty chunk after voiceover ends plus linger", () => {
    // After the last word ends + lingerS, captions should fade out
    // instead of showing stale text during a musical outro.
    const { chunk, chunkStart } = getWordChunk(words, 5.0, 3, 0.3);
    expect(chunk).toEqual([]);
    expect(chunkStart).toBe(words.length);
  });
});

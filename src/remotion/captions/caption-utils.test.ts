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
});

import type { WordTimestamp } from "../../schema/providers";

/**
 * Get a sequential fixed-size chunk of words based on current time.
 * Used by progressive/karaoke-style captions that advance in chunks.
 */
export function getWordChunk(
  words: WordTimestamp[],
  currentTime: number,
  chunkSize: number,
): { chunk: WordTimestamp[]; chunkStart: number } {
  let chunkStart = 0;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, words.length);
    const lastWord = words[chunkEnd - 1];
    if (lastWord && currentTime <= lastWord.end + 0.3) {
      chunkStart = i;
      break;
    }
    chunkStart = i;
  }
  return { chunk: words.slice(chunkStart, chunkStart + chunkSize), chunkStart };
}

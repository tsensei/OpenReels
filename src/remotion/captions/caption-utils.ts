import type { WordTimestamp } from "../../schema/providers";

/**
 * Find the index of the word currently being spoken, or hold the last
 * spoken word during gaps between words.
 * Returns -1 if no word has been spoken yet.
 */
export function findActiveWordIndex(
  words: WordTimestamp[],
  currentTime: number,
): number {
  // Check if any word is actively being spoken
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w && currentTime >= w.start && currentTime < w.end) {
      return i;
    }
  }
  // Hold last spoken word during gaps
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (w && currentTime >= w.end) {
      return i;
    }
  }
  return -1;
}

/**
 * Get a window of words centered around the active word index.
 * Used by styles that spotlight one word with surrounding context.
 */
export function getWordWindow(
  words: WordTimestamp[],
  activeIndex: number,
  radius: number,
): { visible: WordTimestamp[]; startIndex: number } {
  const start = Math.max(0, activeIndex - radius);
  const end = Math.min(words.length, activeIndex + radius + 1);
  return { visible: words.slice(start, end), startIndex: start };
}

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

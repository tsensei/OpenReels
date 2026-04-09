import type { WordTimestamp } from "../../schema/providers";

export type WordState = "unspoken" | "active" | "spoken";

export interface WordRenderState {
  word: WordTimestamp;
  state: WordState;
  springProgress: number;
  emphasis: boolean;
  globalIndex: number;
}

/**
 * Get a sequential fixed-size chunk of words based on current time.
 * lingerS controls how long the chunk stays visible after its last word ends,
 * BUT the linger is cut short if the next chunk's first word has already started.
 * This prevents words from being hidden during the linger window and appearing
 * only in "spoken" state (never showing as "active").
 */
export function getWordChunk(
  words: WordTimestamp[],
  currentTime: number,
  chunkSize: number,
  lingerS: number = 0.3,
): { chunk: WordTimestamp[]; chunkStart: number } {
  let chunkStart = 0;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, words.length);
    const lastWord = words[chunkEnd - 1];
    if (!lastWord) break;

    // Check if we should stay on this chunk:
    // 1. Current time is within the chunk's words, OR
    // 2. Current time is in the linger window AND the next chunk hasn't started speaking
    const withinWords = currentTime <= lastWord.end;
    const nextChunkFirstWord = words[chunkEnd];
    const inLingerWindow = currentTime <= lastWord.end + lingerS;
    const nextChunkStarted = nextChunkFirstWord && currentTime >= nextChunkFirstWord.start;

    if (withinWords || (inLingerWindow && !nextChunkStarted)) {
      chunkStart = i;
      break;
    }
    chunkStart = i;
  }

  // After voiceover ends + linger, return empty chunk so captions fade out
  // instead of lingering stale text during a musical outro.
  const lastWord = words[words.length - 1];
  if (lastWord && currentTime > lastWord.end + lingerS) {
    return { chunk: [], chunkStart: words.length };
  }

  return { chunk: words.slice(chunkStart, chunkStart + chunkSize), chunkStart };
}

/** Determine the display state of a word at a given time. */
export function getWordState(word: WordTimestamp, currentTime: number): WordState {
  if (currentTime < word.start) return "unspoken";
  if (currentTime < word.end) return "active";
  return "spoken";
}

/**
 /**
 * Compute WordRenderState[] for a chunk of words. Pure function, no React hooks.
 *
 * springFn receives a globalIndex and returns the spring progress (0-1) for that
 * word. The caller (CaptionWrapper) maps globalIndex -> frame-based spring
 * computation internally, keeping it seek-safe.
 */
export function computeWordStates(
  chunk: WordTimestamp[],
  chunkStart: number,
  currentTime: number,
  springFn: (globalIndex: number) => number,
  emphasisIndices?: Set<number>,
): WordRenderState[] {
  return chunk.map((word, i) => {
    const globalIndex = chunkStart + i;
    const state = getWordState(word, currentTime);
    const springProgress = state === "unspoken" ? 0 : springFn(globalIndex);
    return {
      word,
      state,
      springProgress,
      emphasis: emphasisIndices?.has(globalIndex) ?? false,
      globalIndex,
    };
  });
}

import type React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import type { WordRenderState } from "./caption-utils";
import { computeWordStates, getWordChunk } from "./caption-utils";

export interface CaptionStyleProps {
  wordStates: WordRenderState[];
  chunkEntryProgress: number;
  accentColor: string;
}

export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass: number;
}

interface CaptionWrapperProps {
  words: WordTimestamp[];
  chunkSize: number;
  lingerS: number;
  accentColor: string;
  springConfig: SpringConfig;
  emphasisIndices?: number[];
  StyleComponent: React.FC<CaptionStyleProps>;
}

/**
 * Shared wrapper that owns timing, word state computation, and chunk entrance.
 * Style components are thin renderers that receive computed WordRenderState[].
 *
 *   CaptionWrapper (this file)
 *   +-- useCurrentFrame() / fps -> currentTime
 *   +-- getWordChunk(words, currentTime, chunkSize, lingerS)
 *   +-- computeWordStates(chunk, chunkStart, currentTime, springFn)
 *   +-- chunkEntryProgress: interpolate over 6 frames from chunk start
 *   +-- <StyleComponent wordStates={...} chunkEntryProgress={...} accentColor={...} />
 */
export const CaptionWrapper: React.FC<CaptionWrapperProps> = ({
  words,
  chunkSize,
  lingerS,
  accentColor,
  springConfig,
  emphasisIndices,
  StyleComponent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const { chunk, chunkStart } = getWordChunk(words, currentTime, chunkSize, lingerS);
  if (chunk.length === 0) return null;

  const emphasisSet = emphasisIndices ? new Set(emphasisIndices) : undefined;

  // Spring function: pure frame-math, seek-safe (no useRef).
  // Each word's spring is computed from its start frame.
  const springFn = (globalIndex: number): number => {
    const word = words[globalIndex];
    if (!word) return 1;
    const wordStartFrame = Math.round(word.start * fps);
    const elapsed = frame - wordStartFrame;
    if (elapsed < 0) return 0;
    return spring({ frame: elapsed, fps, config: springConfig });
  };

  const wordStates = computeWordStates(chunk, chunkStart, currentTime, springFn, emphasisSet);

  // Chunk entrance fade: 6-frame interpolate from the first word's start frame.
  const chunkStartFrame = Math.round(chunk[0]!.start * fps);
  const framesSinceChunk = Math.max(0, frame - chunkStartFrame);
  const chunkEntryProgress = interpolate(framesSinceChunk, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "18%",
      }}
    >
      <div style={{ opacity: chunkEntryProgress }}>
        <StyleComponent
          wordStates={wordStates}
          chunkEntryProgress={chunkEntryProgress}
          accentColor={accentColor}
        />
      </div>
    </AbsoluteFill>
  );
};

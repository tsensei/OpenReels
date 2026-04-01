import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import { CAPTION_FONTS } from "../lib/fonts";
import { getWordChunk } from "./caption-utils";

interface CaptionProps {
  words: WordTimestamp[];
}

export const Clean: React.FC<CaptionProps> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const { chunk, chunkStart } = getWordChunk(words, currentTime, 5);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "18%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 8,
          padding: "0 40px",
        }}
      >
        {chunk.map((w, i) => {
          const isSpoken = currentTime >= w.start;
          const globalIndex = chunkStart + i;
          return (
            <span
              key={`${w.word}-${globalIndex}`}
              style={{
                fontSize: isSpoken ? 56 : 44,
                fontWeight: isSpoken ? 700 : 500,
                color: isSpoken ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                fontFamily: CAPTION_FONTS.inter,
                textShadow: "0 2px 10px rgba(0,0,0,0.7)",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

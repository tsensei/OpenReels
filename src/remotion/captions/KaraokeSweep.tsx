import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import { getWordChunk } from "./caption-utils";
import { CAPTION_FONTS } from "../lib/fonts";

interface CaptionProps {
  words: WordTimestamp[];
}

export const KaraokeSweep: React.FC<CaptionProps> = ({ words }) => {
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
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, padding: "0 40px" }}>
        {chunk.map((w, i) => {
          const isSpoken = currentTime >= w.start;
          const globalIndex = chunkStart + i;
          return (
            <span
              key={`${w.word}-${globalIndex}`}
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: "#FFFFFF",
                fontFamily: CAPTION_FONTS.montserrat,
                textTransform: "uppercase",
                backgroundColor: isSpoken ? "#38A169" : "transparent",
                borderRadius: isSpoken ? 6 : 0,
                padding: isSpoken ? "4px 10px" : "4px 2px",
                opacity: isSpoken ? 1 : 0.4,
                textShadow: isSpoken ? "none" : "0 2px 8px rgba(0,0,0,0.6)",
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

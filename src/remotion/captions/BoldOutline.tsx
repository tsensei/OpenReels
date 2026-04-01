import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import { CAPTION_FONTS } from "../lib/fonts";
import { getWordChunk } from "./caption-utils";

interface CaptionProps {
  words: WordTimestamp[];
}

export const BoldOutline: React.FC<CaptionProps> = ({ words }) => {
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
              style={
                {
                  fontSize: isSpoken ? 72 : 48,
                  fontWeight: isSpoken ? 900 : 700,
                  color: "#FFFFFF",
                  fontFamily: CAPTION_FONTS.montserrat,
                  textTransform: "uppercase",
                  WebkitTextStroke: isSpoken ? "3px #000000" : "2px #000000",
                  paintOrder: "stroke fill",
                  opacity: isSpoken ? 1 : 0.5,
                  textShadow: "0 4px 12px rgba(0,0,0,0.8)",
                } as React.CSSProperties
              }
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

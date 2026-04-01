import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import { CAPTION_FONTS } from "../lib/fonts";
import { getWordChunk } from "./caption-utils";

interface CaptionProps {
  words: WordTimestamp[];
}

export const GradientRise: React.FC<CaptionProps> = ({ words }) => {
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
          gap: 10,
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
                  fontSize: isSpoken ? 64 : 48,
                  fontWeight: 700,
                  fontFamily: CAPTION_FONTS.playfairDisplay,
                  background: isSpoken ? "linear-gradient(135deg, #9F7AEA, #E53E3E)" : "none",
                  WebkitBackgroundClip: isSpoken ? "text" : undefined,
                  WebkitTextFillColor: isSpoken ? "transparent" : "rgba(255,255,255,0.45)",
                  color: isSpoken ? undefined : "rgba(255,255,255,0.45)",
                  textShadow: isSpoken ? "none" : "0 2px 8px rgba(0,0,0,0.5)",
                  filter: isSpoken ? "drop-shadow(0 3px 12px rgba(159,122,234,0.5))" : "none",
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

import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import { CAPTION_FONTS } from "../lib/fonts";
import { getWordChunk } from "./caption-utils";

interface CaptionProps {
  words: WordTimestamp[];
}

export const BlockImpact: React.FC<CaptionProps> = ({ words }) => {
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
          backgroundColor: "rgba(0,0,0,0.85)",
          borderRadius: 12,
          padding: "14px 28px",
          maxWidth: "90%",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          {chunk.map((w, i) => {
            const isSpoken = currentTime >= w.start;
            const globalIndex = chunkStart + i;
            return (
              <span
                key={`${w.word}-${globalIndex}`}
                style={{
                  fontSize: 52,
                  fontWeight: 700,
                  color: isSpoken ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                  fontFamily: CAPTION_FONTS.oswald,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import { findActiveWordIndex, getWordWindow } from "./caption-utils";
import { CAPTION_FONTS } from "../lib/fonts";

interface CaptionProps {
  words: WordTimestamp[];
}

export const ColorHighlight: React.FC<CaptionProps> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeIndex = findActiveWordIndex(words, currentTime);
  if (activeIndex === -1) return null;

  const { visible, startIndex } = getWordWindow(words, activeIndex, 2);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "18%",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, padding: "0 40px" }}>
        {visible.map((w, i) => {
          const globalIndex = startIndex + i;
          const isActive = globalIndex === activeIndex;
          return (
            <span
              key={`${w.word}-${globalIndex}`}
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: "#FFFFFF",
                fontFamily: CAPTION_FONTS.montserrat,
                textTransform: "uppercase",
                backgroundColor: isActive ? "#E53E3E" : "transparent",
                borderRadius: isActive ? 6 : 0,
                padding: isActive ? "4px 10px" : "4px 2px",
                opacity: isActive ? 1 : 0.5,
                textShadow: isActive ? "none" : "0 2px 8px rgba(0,0,0,0.6)",
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

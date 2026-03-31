import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import { findActiveWordIndex, getWordWindow } from "./caption-utils";
import { CAPTION_FONTS } from "../lib/fonts";

interface CaptionProps {
  words: WordTimestamp[];
}

export const BoldOutline: React.FC<CaptionProps> = ({ words }) => {
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
                fontSize: isActive ? 72 : 48,
                fontWeight: isActive ? 900 : 700,
                color: "#FFFFFF",
                fontFamily: CAPTION_FONTS.montserrat,
                textTransform: "uppercase",
                WebkitTextStroke: isActive ? "3px #000000" : "2px #000000",
                paintOrder: "stroke fill",
                opacity: isActive ? 1 : 0.5,
                textShadow: "0 4px 12px rgba(0,0,0,0.8)",
              } as React.CSSProperties}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

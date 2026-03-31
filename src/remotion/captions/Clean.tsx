import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import { findActiveWordIndex, getWordWindow } from "./caption-utils";
import { CAPTION_FONTS } from "../lib/fonts";

interface CaptionProps {
  words: WordTimestamp[];
}

export const Clean: React.FC<CaptionProps> = ({ words }) => {
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
                fontSize: isActive ? 56 : 44,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.5)",
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

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";
import { findActiveWordIndex, getWordWindow } from "./caption-utils";
import { CAPTION_FONTS } from "../lib/fonts";

interface CaptionProps {
  words: WordTimestamp[];
}

export const GradientRise: React.FC<CaptionProps> = ({ words }) => {
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
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, padding: "0 40px" }}>
        {visible.map((w, i) => {
          const globalIndex = startIndex + i;
          const isActive = globalIndex === activeIndex;
          return (
            <span
              key={`${w.word}-${globalIndex}`}
              style={{
                fontSize: isActive ? 64 : 48,
                fontWeight: 700,
                fontFamily: CAPTION_FONTS.playfairDisplay,
                background: isActive
                  ? "linear-gradient(135deg, #9F7AEA, #E53E3E)"
                  : "none",
                WebkitBackgroundClip: isActive ? "text" : undefined,
                WebkitTextFillColor: isActive ? "transparent" : "rgba(255,255,255,0.45)",
                color: isActive ? undefined : "rgba(255,255,255,0.45)",
                textShadow: isActive ? "none" : "0 2px 8px rgba(0,0,0,0.5)",
                filter: isActive ? "drop-shadow(0 3px 12px rgba(159,122,234,0.5))" : "none",
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

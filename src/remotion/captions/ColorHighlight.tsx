import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Color highlight caption style: accent-colored background behind spoken words.
 * Uses accent color from archetype palette.
 */
export const ColorHighlight: React.FC<CaptionStyleProps> = ({ wordStates, accentColor }) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      padding: "0 40px",
    }}
  >
    {wordStates.map((ws) => {
      const isSpoken = ws.state !== "unspoken";
      return (
        <span
          key={`${ws.word.word}-${ws.globalIndex}`}
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: CAPTION_FONTS.montserrat,
            textTransform: "uppercase",
            backgroundColor: isSpoken ? accentColor : "transparent",
            borderRadius: isSpoken ? 6 : 0,
            padding: isSpoken ? "4px 10px" : "4px 2px",
            opacity: isSpoken ? 1 : 0.5,
            textShadow: isSpoken ? "none" : "0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          {ws.word.word}
        </span>
      );
    })}
  </div>
);

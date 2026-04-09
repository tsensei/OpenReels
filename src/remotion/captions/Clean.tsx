import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Clean caption style: minimalist white text with subtle shadow.
 * Spoken words are brighter and slightly larger than unspoken.
 */
export const Clean: React.FC<CaptionStyleProps> = ({ wordStates }) => (
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
            fontSize: isSpoken ? 56 : 44,
            fontWeight: isSpoken ? 700 : 500,
            color: isSpoken ? "#FFFFFF" : "rgba(255,255,255,0.5)",
            fontFamily: CAPTION_FONTS.inter,
            textShadow: "0 2px 10px rgba(0,0,0,0.7)",
          }}
        >
          {ws.word.word}
        </span>
      );
    })}
  </div>
);

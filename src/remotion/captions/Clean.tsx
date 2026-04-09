import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Clean caption style: minimalist white text with subtle shadow.
 * Active word springs slightly larger and brighter. Spoken words settle.
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
      const fontSize = 44 + ws.springProgress * 8; // 44 -> 52
      return (
        <span
          key={`${ws.word.word}-${ws.globalIndex}`}
          style={{
            fontSize,
            fontWeight: ws.state === "unspoken" ? 500 : 700,
            color:
              ws.state === "unspoken"
                ? "rgba(255,255,255,0.4)"
                : ws.state === "active"
                  ? "#FFFFFF"
                  : "rgba(255,255,255,0.75)",
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

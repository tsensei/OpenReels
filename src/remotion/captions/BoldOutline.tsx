import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Bold outline caption style: white uppercase text with bold stroke.
 * Active word springs larger with heavier stroke. Punchy spring config.
 */
export const BoldOutline: React.FC<CaptionStyleProps> = ({ wordStates }) => (
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
      const fontSize = 48 + ws.springProgress * 8; // 48 -> 56
      const strokeWidth = 2 + ws.springProgress; // 2px -> 3px
      return (
        <span
          key={`${ws.word.word}-${ws.globalIndex}`}
          style={
            {
              fontSize,
              fontWeight: ws.state === "unspoken" ? 700 : 900,
              color: "#FFFFFF",
              fontFamily: CAPTION_FONTS.montserrat,
              textTransform: "uppercase",
              WebkitTextStroke: `${strokeWidth}px #000000`,
              paintOrder: "stroke fill",
              opacity: ws.state === "unspoken" ? 0.5 : ws.state === "active" ? 1 : 0.85,
              textShadow: "0 4px 12px rgba(0,0,0,0.8)",
            } as React.CSSProperties
          }
        >
          {ws.word.word}
        </span>
      );
    })}
  </div>
);

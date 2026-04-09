import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Bold outline caption style: white uppercase text with bold stroke.
 * Spoken words scale up with heavier stroke.
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
      const isSpoken = ws.state !== "unspoken";
      return (
        <span
          key={`${ws.word.word}-${ws.globalIndex}`}
          style={
            {
              fontSize: isSpoken ? 72 : 48,
              fontWeight: isSpoken ? 900 : 700,
              color: "#FFFFFF",
              fontFamily: CAPTION_FONTS.montserrat,
              textTransform: "uppercase",
              WebkitTextStroke: isSpoken ? "3px #000000" : "2px #000000",
              paintOrder: "stroke fill",
              opacity: isSpoken ? 1 : 0.5,
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

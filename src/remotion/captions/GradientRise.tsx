import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Gradient rise caption style: purple-to-red gradient on spoken words.
 * Elegant Playfair Display font with drop-shadow.
 */
export const GradientRise: React.FC<CaptionStyleProps> = ({ wordStates }) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 10,
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
              fontSize: isSpoken ? 64 : 48,
              fontWeight: 700,
              fontFamily: CAPTION_FONTS.playfairDisplay,
              background: isSpoken ? "linear-gradient(135deg, #9F7AEA, #E53E3E)" : "none",
              WebkitBackgroundClip: isSpoken ? "text" : undefined,
              WebkitTextFillColor: isSpoken ? "transparent" : "rgba(255,255,255,0.45)",
              color: isSpoken ? undefined : "rgba(255,255,255,0.45)",
              textShadow: isSpoken ? "none" : "0 2px 8px rgba(0,0,0,0.5)",
              filter: isSpoken ? "drop-shadow(0 3px 12px rgba(159,122,234,0.5))" : "none",
            } as React.CSSProperties
          }
        >
          {ws.word.word}
        </span>
      );
    })}
  </div>
);

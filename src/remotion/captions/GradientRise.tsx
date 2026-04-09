import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Gradient rise caption style: purple-to-red gradient on active/spoken words.
 * Elegant spring with low damping. Drop-shadow halo on active word.
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
      const fontSize = 48 + ws.springProgress * 8; // 48 -> 56
      const isLit = ws.state !== "unspoken";
      return (
        <span
          key={`${ws.word.word}-${ws.globalIndex}`}
          style={
            {
              fontSize,
              fontWeight: 700,
              fontFamily: CAPTION_FONTS.playfairDisplay,
              background: isLit ? "linear-gradient(135deg, #9F7AEA, #E53E3E)" : "none",
              WebkitBackgroundClip: isLit ? "text" : undefined,
              WebkitTextFillColor: isLit ? "transparent" : "rgba(255,255,255,0.45)",
              color: isLit ? undefined : "rgba(255,255,255,0.45)",
              textShadow: isLit ? "none" : "0 2px 8px rgba(0,0,0,0.5)",
              filter:
                ws.state === "active"
                  ? "drop-shadow(0 3px 12px rgba(159,122,234,0.5))"
                  : "none",
            } as React.CSSProperties
          }
        >
          {ws.word.word}
        </span>
      );
    })}
  </div>
);

import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Block impact caption style: dark translucent box with uppercase text.
 * Spoken words are bright white, unspoken are dimmed.
 */
export const BlockImpact: React.FC<CaptionStyleProps> = ({ wordStates }) => (
  <div
    style={{
      backgroundColor: "rgba(0,0,0,0.85)",
      borderRadius: 12,
      padding: "14px 28px",
      maxWidth: "90%",
    }}
  >
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
      {wordStates.map((ws) => {
        const isSpoken = ws.state !== "unspoken";
        return (
          <span
            key={`${ws.word.word}-${ws.globalIndex}`}
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: isSpoken ? "#FFFFFF" : "rgba(255,255,255,0.35)",
              fontFamily: CAPTION_FONTS.oswald,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {ws.word.word}
          </span>
        );
      })}
    </div>
  </div>
);

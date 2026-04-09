import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Block impact caption style: dark translucent box with uppercase text.
 * Snappy spring config. Active word flashes bright white, spoken settles.
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
      {wordStates.map((ws) => (
        <span
          key={`${ws.word.word}-${ws.globalIndex}`}
          style={{
            fontSize: 48 + ws.springProgress * 6, // 48 -> 54
            fontWeight: 700,
            color:
              ws.state === "unspoken"
                ? "rgba(255,255,255,0.3)"
                : ws.state === "active"
                  ? "#FFFFFF"
                  : "rgba(255,255,255,0.7)",
            fontFamily: CAPTION_FONTS.oswald,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {ws.word.word}
        </span>
      ))}
    </div>
  </div>
);

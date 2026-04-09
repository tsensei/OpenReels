import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Karaoke sweep caption style: highlight box appears behind spoken words.
 * Uses accent color from archetype palette.
 */
export const KaraokeSweep: React.FC<CaptionStyleProps> = ({ wordStates, accentColor }) => (
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
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: CAPTION_FONTS.montserrat,
            textTransform: "uppercase",
            backgroundColor: isSpoken ? accentColor : "transparent",
            borderRadius: isSpoken ? 6 : 0,
            padding: isSpoken ? "4px 10px" : "4px 2px",
            opacity: isSpoken ? 1 : 0.4,
            textShadow: isSpoken ? "none" : "0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          {ws.word.word}
        </span>
      );
    })}
  </div>
);

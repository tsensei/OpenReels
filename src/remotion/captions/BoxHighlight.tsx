import type React from "react";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Box highlight caption style: spring-animated background rectangle on the active word.
 * The "box" appears via spring-driven padding expansion on the active word's span.
 * Non-active words have no background. Creates a tracking highlight effect.
 */
export const BoxHighlight: React.FC<CaptionStyleProps> = ({ wordStates, accentColor }) => (
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
      const isActive = ws.state === "active";
      // Spring-animated padding: grows from 2px to 10px as the word activates.
      const pad = 2 + ws.springProgress * 8;
      return (
        <span
          key={`${ws.word.word}-${ws.globalIndex}`}
          style={{
            fontSize: 52 + ws.springProgress * 6, // 52 -> 58
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: CAPTION_FONTS.montserrat,
            textTransform: "uppercase",
            backgroundColor: isActive
              ? accentColor
              : ws.state === "spoken"
                ? "rgba(255,255,255,0.08)"
                : "transparent",
            borderRadius: isActive ? 8 * ws.springProgress : ws.state === "spoken" ? 4 : 0,
            padding: `4px ${pad}px`,
            opacity: ws.state === "unspoken" ? 0.4 : 1,
            textShadow: ws.state === "unspoken" ? "0 2px 8px rgba(0,0,0,0.6)" : "none",
          }}
        >
          {ws.word.word}
        </span>
      );
    })}
  </div>
);

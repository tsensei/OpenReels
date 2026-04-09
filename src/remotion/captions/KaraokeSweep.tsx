import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION_FONTS } from "../lib/fonts";
import type { CaptionStyleProps } from "./CaptionWrapper";

/**
 * Karaoke sweep caption style: gradient wipe fills left-to-right behind active word.
 * Spoken words show solid accent background. Unspoken are transparent.
 * Uses linear interpolate (not spring) for fill progress to avoid overshoot.
 */
export const KaraokeSweep: React.FC<CaptionStyleProps> = ({ wordStates, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  return (
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
        let background: string;
        if (ws.state === "active") {
          // Gradient wipe: fill progresses left-to-right during the word's duration.
          // Guard: zero-duration words (start === end) crash interpolate() with
          // "inputRange must be strictly monotonically non-decreasing".
          const fillProgress =
            ws.word.start >= ws.word.end
              ? 100
              : interpolate(
                  currentTime,
                  [ws.word.start, ws.word.end],
                  [0, 100],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
          background = `linear-gradient(90deg, ${accentColor} ${fillProgress}%, rgba(255,255,255,0.1) ${fillProgress}%)`;
        } else if (ws.state === "spoken") {
          background = accentColor;
        } else {
          background = "transparent";
        }

        return (
          <span
            key={`${ws.word.word}-${ws.globalIndex}`}
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "#FFFFFF",
              fontFamily: CAPTION_FONTS.montserrat,
              textTransform: "uppercase",
              background,
              borderRadius: ws.state !== "unspoken" ? 6 : 0,
              padding: ws.state !== "unspoken" ? "4px 10px" : "4px 2px",
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
};

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { SceneProps } from "../lib/score-to-props";

export const TextCardBeat: React.FC<SceneProps> = ({ textOverlay, colorPalette, textCardFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleIn = spring({ frame, fps, config: { damping: 15, stiffness: 100 } });

  const bg = colorPalette?.background ?? "#1a1a2e";
  const accent = colorPalette?.accent ?? "#e94560";
  const text = colorPalette?.text ?? "#ffffff";

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${bg} 0%, ${accent}22 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
      }}
    >
      <div
        style={{
          transform: `scale(${scaleIn})`,
          textAlign: "center",
          color: text,
          fontSize: 72,
          fontWeight: 900,
          fontFamily: textCardFont ?? "Inter, sans-serif",
          lineHeight: 1.2,
          textShadow: `0 0 40px ${accent}66`,
        }}
      >
        {textOverlay ?? ""}
      </div>
      {/* Accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          left: "20%",
          right: "20%",
          height: 6,
          backgroundColor: accent,
          borderRadius: 3,
          transform: `scaleX(${scaleIn})`,
        }}
      />
    </AbsoluteFill>
  );
};

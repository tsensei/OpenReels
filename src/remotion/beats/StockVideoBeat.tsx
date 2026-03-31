import React from "react";
import { AbsoluteFill, Loop, OffthreadVideo, useVideoConfig } from "remotion";
import type { SceneProps } from "../lib/score-to-props";

export const StockVideoBeat: React.FC<SceneProps> = ({ assetSrc, textOverlay, colorPalette, sourceDurationInSeconds }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const sceneDurationSeconds = durationInFrames / fps;

  // If we know the source video duration and it's shorter than the scene, loop it.
  // Otherwise, play once with trim (endAt handles videos longer than the scene).
  const needsLoop = sourceDurationInSeconds != null && sourceDurationInSeconds < sceneDurationSeconds;
  const loopDurationInFrames = sourceDurationInSeconds != null
    ? Math.round(sourceDurationInSeconds * fps)
    : durationInFrames;

  const video = assetSrc ? (
    <OffthreadVideo
      src={assetSrc}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
      muted
    />
  ) : null;

  return (
    <AbsoluteFill>
      {video && (needsLoop ? (
        <Loop durationInFrames={loopDurationInFrames}>{video}</Loop>
      ) : video)}
      {textOverlay && (
        <div
          style={{
            position: "absolute",
            top: "15%",
            left: "5%",
            right: "5%",
            textAlign: "center",
            color: colorPalette?.text ?? "#fff",
            fontSize: 48,
            fontWeight: 800,
            textShadow: "0 4px 20px rgba(0,0,0,0.8)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {textOverlay}
        </div>
      )}
    </AbsoluteFill>
  );
};

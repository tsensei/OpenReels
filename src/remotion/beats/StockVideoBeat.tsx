import type React from "react";
import { AbsoluteFill, Loop, OffthreadVideo, useVideoConfig } from "remotion";
import type { SceneProps } from "../lib/score-to-props";

export const StockVideoBeat: React.FC<SceneProps> = ({ assetSrc, sourceDurationInSeconds }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const sceneDurationSeconds = durationInFrames / fps;

  // If we know the source video duration and it's shorter than the scene, loop it.
  // Otherwise, play once with trim (endAt handles videos longer than the scene).
  const needsLoop =
    sourceDurationInSeconds != null && sourceDurationInSeconds < sceneDurationSeconds;
  const loopDurationInFrames =
    sourceDurationInSeconds != null ? Math.floor(sourceDurationInSeconds * fps) : durationInFrames;

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
      {video && (needsLoop ? <Loop durationInFrames={loopDurationInFrames}>{video}</Loop> : video)}
    </AbsoluteFill>
  );
};

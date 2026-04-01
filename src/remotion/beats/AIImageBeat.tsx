import type React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneProps } from "../lib/score-to-props";

export const AIImageBeat: React.FC<SceneProps> = ({ assetSrc, motion, motionIntensity = 1.2 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;

  const scale = (() => {
    const intensity = motionIntensity;
    switch (motion) {
      case "zoom_in":
        return interpolate(progress, [0, 1], [1, 1 + 0.15 * intensity]);
      case "zoom_out":
        return interpolate(progress, [0, 1], [1 + 0.15 * intensity, 1]);
      case "pan_left":
      case "pan_right":
        return 1.15;
      default:
        return 1;
    }
  })();

  const translateX = (() => {
    const intensity = motionIntensity;
    switch (motion) {
      case "pan_right":
        return interpolate(progress, [0, 1], [0, 50 * intensity]);
      case "pan_left":
        return interpolate(progress, [0, 1], [0, -50 * intensity]);
      default:
        return 0;
    }
  })();

  return (
    <AbsoluteFill>
      {assetSrc && (
        <Img
          src={assetSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale}) translateX(${translateX}px)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

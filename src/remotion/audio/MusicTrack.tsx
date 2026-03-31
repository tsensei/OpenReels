import React from "react";
import { Audio, useVideoConfig } from "remotion";
import type { WordTimestamp } from "../../schema/providers";

interface MusicTrackProps {
  src: string;
  words: WordTimestamp[];
}

const FULL_VOLUME = 0.3;
const DUCKED_VOLUME = 0.08;
const RAMP_DURATION_S = 0.1; // 100ms easing ramp

export const MusicTrack: React.FC<MusicTrackProps> = ({ src, words }) => {
  const { fps } = useVideoConfig();

  const volumeCallback = (frame: number): number => {
    const currentTime = frame / fps;

    // Check if any word is being spoken (with ramp zones)
    for (const w of words) {
      const rampIn = w.start - RAMP_DURATION_S;
      const rampOut = w.end + RAMP_DURATION_S;

      if (currentTime >= w.start && currentTime <= w.end) {
        return DUCKED_VOLUME;
      }
      // Ramp down before speech starts
      if (currentTime >= rampIn && currentTime < w.start) {
        const progress = (currentTime - rampIn) / RAMP_DURATION_S;
        return FULL_VOLUME - (FULL_VOLUME - DUCKED_VOLUME) * progress;
      }
      // Ramp up after speech ends
      if (currentTime > w.end && currentTime <= rampOut) {
        const progress = (currentTime - w.end) / RAMP_DURATION_S;
        return DUCKED_VOLUME + (FULL_VOLUME - DUCKED_VOLUME) * progress;
      }
    }

    return FULL_VOLUME;
  };

  return <Audio src={src} volume={volumeCallback} loop />;
};

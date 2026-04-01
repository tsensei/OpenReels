import type React from "react";
import { useMemo } from "react";
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
  const { fps, durationInFrames } = useVideoConfig();

  const volumeByFrame = useMemo(() => {
    const volumes = new Float32Array(durationInFrames);

    // Fill with full volume
    volumes.fill(FULL_VOLUME);

    // Stamp ducking zones from each word onto the frame array
    for (const w of words) {
      const rampInStart = Math.max(0, Math.floor((w.start - RAMP_DURATION_S) * fps));
      const speechStart = Math.floor(w.start * fps);
      const speechEnd = Math.ceil(w.end * fps);
      const rampOutEnd = Math.min(durationInFrames - 1, Math.ceil((w.end + RAMP_DURATION_S) * fps));

      // Ramp down before speech
      for (let f = rampInStart; f < speechStart && f < durationInFrames; f++) {
        const progress = (f / fps - (w.start - RAMP_DURATION_S)) / RAMP_DURATION_S;
        const vol = FULL_VOLUME - (FULL_VOLUME - DUCKED_VOLUME) * progress;
        volumes[f] = Math.min(volumes[f]!, vol);
      }

      // Ducked during speech
      for (let f = speechStart; f <= speechEnd && f < durationInFrames; f++) {
        volumes[f] = DUCKED_VOLUME;
      }

      // Ramp up after speech
      for (let f = speechEnd + 1; f <= rampOutEnd && f < durationInFrames; f++) {
        const progress = (f / fps - w.end) / RAMP_DURATION_S;
        const vol = DUCKED_VOLUME + (FULL_VOLUME - DUCKED_VOLUME) * progress;
        volumes[f] = Math.min(volumes[f]!, vol);
      }
    }

    return volumes;
  }, [words, fps, durationInFrames]);

  const volumeCallback = (frame: number): number => {
    return volumeByFrame[frame] ?? FULL_VOLUME;
  };

  return <Audio src={src} volume={volumeCallback} loop />;
};

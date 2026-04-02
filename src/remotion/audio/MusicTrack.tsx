import type React from "react";
import { Audio } from "remotion";

interface MusicTrackProps {
  src: string;
}

const MUSIC_VOLUME = 0.15;

export const MusicTrack: React.FC<MusicTrackProps> = ({ src }) => {
  return <Audio src={src} volume={MUSIC_VOLUME} loop />;
};

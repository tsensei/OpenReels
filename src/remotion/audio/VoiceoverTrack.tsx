import type React from "react";
import { Audio } from "remotion";

interface VoiceoverTrackProps {
  src: string;
}

export const VoiceoverTrack: React.FC<VoiceoverTrackProps> = ({ src }) => {
  return <Audio src={src} />;
};

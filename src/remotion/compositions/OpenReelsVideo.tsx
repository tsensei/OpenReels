import React from "react";
import { AbsoluteFill, Composition, Sequence, Audio, staticFile } from "remotion";
import type { CompositionProps, SceneProps } from "../lib/score-to-props";
import { AIImageBeat } from "../beats/AIImageBeat";
import { StockImageBeat } from "../beats/StockImageBeat";
import { StockVideoBeat } from "../beats/StockVideoBeat";
import { TextCardBeat } from "../beats/TextCardBeat";
import { MusicTrack } from "../audio/MusicTrack";
import { BoldOutline } from "../captions/BoldOutline";
import { ColorHighlight } from "../captions/ColorHighlight";
import { Clean } from "../captions/Clean";
import { KaraokeSweep } from "../captions/KaraokeSweep";
import { GradientRise } from "../captions/GradientRise";
import { BlockImpact } from "../captions/BlockImpact";

const BEAT_COMPONENTS: Record<string, React.FC<SceneProps>> = {
  ai_image: AIImageBeat,
  stock_image: StockImageBeat,
  stock_video: StockVideoBeat,
  text_card: TextCardBeat,
};

const CAPTION_COMPONENTS: Record<string, React.FC<any>> = {
  bold_outline: BoldOutline,
  color_highlight: ColorHighlight,
  clean: Clean,
  karaoke_sweep: KaraokeSweep,
  gradient_rise: GradientRise,
  block_impact: BlockImpact,
};

const resolveAsset = (relativePath: string | null): string | null => {
  if (!relativePath) return null;
  return staticFile(relativePath);
};

const Main: React.FC<CompositionProps> = ({ scenes, captionStyle, voiceoverSrc, musicSrc, allWords }) => {
  let frameOffset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Scene beats — each in its own Sequence (resets frame for visuals) */}
      {scenes.map((scene, i) => {
        const BeatComponent = BEAT_COMPONENTS[scene.visualType] ?? TextCardBeat;
        const startFrame = frameOffset;
        frameOffset += scene.durationInFrames;

        return (
          <Sequence key={i} from={startFrame} durationInFrames={scene.durationInFrames}>
            <BeatComponent {...scene} assetSrc={resolveAsset(scene.assetSrc)} />
          </Sequence>
        );
      })}

      {/*
        Captions — ONE component at top level, NOT inside per-scene Sequences.
        Uses absolute timestamps from the full TTS voiceover.
        useCurrentFrame() here returns the absolute frame in the full video,
        which matches the absolute word timestamps from ElevenLabs.
        This is how ReelMistri keeps captions in sync.
      */}
      {allWords && allWords.length > 0 && (() => {
        const CaptionComponent = CAPTION_COMPONENTS[captionStyle] ?? Clean;
        return <CaptionComponent words={allWords} />;
      })()}

      {/* Voiceover — single continuous audio track */}
      {voiceoverSrc && <Audio src={resolveAsset(voiceoverSrc)!} />}

      {/* Background music with ducking (computed inside MusicTrack from word timestamps) */}
      {musicSrc && (
        <MusicTrack src={resolveAsset(musicSrc)!} words={allWords ?? []} />
      )}
    </AbsoluteFill>
  );
};

export const OpenReelsVideo: React.FC = () => {
  return (
    <>
      <Composition
        id="OpenReelsVideo"
        component={Main as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: [],
          captionStyle: "clean",
          voiceoverSrc: null,
          musicSrc: null,
          allWords: [],
        } as unknown as Record<string, unknown>}
      />
    </>
  );
};

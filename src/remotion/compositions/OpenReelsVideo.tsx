import React from "react";
import { AbsoluteFill, Composition, Audio, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTransitionPresentation(type: string): any {
  switch (type) {
    case "crossfade": return fade();
    case "slide_left": return slide({ direction: "from-right" });
    case "slide_right": return slide({ direction: "from-left" });
    case "wipe": return wipe();
    case "flip": return flip();
    case "none": return null;
    default: return null;
  }
}

const Main: React.FC<CompositionProps> = ({ scenes, captionStyle, voiceoverSrc, musicSrc, allWords }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Scene beats with transitions — TransitionSeries handles timing and overlaps */}
      <TransitionSeries>
        {scenes.map((scene, i) => {
          const BeatComponent = BEAT_COMPONENTS[scene.visualType] ?? TextCardBeat;
          const prevScene = i > 0 ? scenes[i - 1] : undefined;
          const presentation = prevScene
            ? getTransitionPresentation(prevScene.transition)
            : null;

          return (
            <React.Fragment key={i}>
              {presentation && prevScene && (
                <TransitionSeries.Transition
                  presentation={presentation}
                  timing={linearTiming({ durationInFrames: prevScene.transitionDurationFrames })}
                />
              )}
              <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
                <BeatComponent {...scene} assetSrc={resolveAsset(scene.assetSrc)} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>

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

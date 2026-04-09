import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, Audio, Composition, staticFile } from "remotion";
import type { TransitionType } from "../../schema/director-score";
import { MusicTrack } from "../audio/MusicTrack";
import { AIImageBeat } from "../beats/AIImageBeat";
import { StockImageBeat } from "../beats/StockImageBeat";
import { StockVideoBeat } from "../beats/StockVideoBeat";
import { TextCardBeat } from "../beats/TextCardBeat";
import { BlockImpact } from "../captions/BlockImpact";
import { BoldOutline } from "../captions/BoldOutline";
import { CaptionWrapper, type SpringConfig } from "../captions/CaptionWrapper";
import { Clean } from "../captions/Clean";
import { ColorHighlight } from "../captions/ColorHighlight";
import { GradientRise } from "../captions/GradientRise";
import { KaraokeSweep } from "../captions/KaraokeSweep";
import type { CaptionStyleProps } from "../captions/CaptionWrapper";
import type { CompositionProps, SceneProps } from "../lib/score-to-props";

const BEAT_COMPONENTS: Record<string, React.FC<SceneProps>> = {
  ai_image: AIImageBeat,
  ai_video: StockVideoBeat,
  stock_image: StockImageBeat,
  stock_video: StockVideoBeat,
  text_card: TextCardBeat,
};

/** Caption style registry: component + per-style spring physics config. */
const CAPTION_STYLES: Record<string, { component: React.FC<CaptionStyleProps>; springConfig: SpringConfig }> = {
  bold_outline:    { component: BoldOutline,    springConfig: { damping: 15, stiffness: 250, mass: 0.5 } },
  clean:           { component: Clean,          springConfig: { damping: 12, stiffness: 200, mass: 0.5 } },
  gradient_rise:   { component: GradientRise,   springConfig: { damping: 8,  stiffness: 150, mass: 0.5 } },
  karaoke_sweep:   { component: KaraokeSweep,   springConfig: { damping: 14, stiffness: 220, mass: 0.5 } },
  color_highlight: { component: ColorHighlight, springConfig: { damping: 12, stiffness: 200, mass: 0.5 } },
  block_impact:    { component: BlockImpact,    springConfig: { damping: 18, stiffness: 300, mass: 0.5 } },
};

const resolveAsset = (relativePath: string | null): string | null => {
  if (!relativePath) return null;
  return staticFile(relativePath);
};

// Returns { presentation, timing } for a given transition type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTransition(
  type: TransitionType,
  durationInFrames: number,
): { presentation: any; timing: any } | null {
  const linear = linearTiming({ durationInFrames });
  switch (type) {
    case "crossfade":
      return { presentation: fade(), timing: linear };
    case "slide_left":
      return { presentation: slide({ direction: "from-right" }), timing: linear };
    case "slide_right":
      return { presentation: slide({ direction: "from-left" }), timing: linear };
    case "wipe":
      return { presentation: wipe({ direction: "from-left" }), timing: linear };
    case "flip":
      return { presentation: flip(), timing: linear };
    case "none":
      return null;
    default:
      return null;
  }
}

const Main: React.FC<CompositionProps> = ({
  scenes,
  captionStyle,
  voiceoverSrc,
  musicSrc,
  allWords,
  captionAccentColor,
  captionChunkSize,
  captionLingerS,
}) => {
  const style = CAPTION_STYLES[captionStyle] ?? CAPTION_STYLES.clean!;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Scene beats with transitions */}
      <TransitionSeries>
        {scenes.map((scene, i) => {
          const BeatComponent = BEAT_COMPONENTS[scene.visualType] ?? TextCardBeat;
          const prevScene = i > 0 ? scenes[i - 1] : undefined;
          const trans = prevScene
            ? getTransition(prevScene.transition, prevScene.transitionDurationFrames)
            : null;

          return (
            <React.Fragment key={i}>
              {trans && (
                <TransitionSeries.Transition
                  presentation={trans.presentation}
                  timing={trans.timing}
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
        Captions — CaptionWrapper at top level, NOT inside per-scene Sequences.
        Uses absolute timestamps from the full TTS voiceover.
        useCurrentFrame() returns the absolute frame in the full video,
        which matches the absolute word timestamps.
      */}
      {allWords && allWords.length > 0 && (
        <CaptionWrapper
          words={allWords}
          chunkSize={captionChunkSize}
          lingerS={captionLingerS}
          accentColor={captionAccentColor}
          springConfig={style.springConfig}
          StyleComponent={style.component}
        />
      )}

      {/* Voiceover — single continuous audio track */}
      {voiceoverSrc && <Audio src={resolveAsset(voiceoverSrc)!} />}

      {/* Background music — flat volume under continuous voiceover */}
      {musicSrc && <MusicTrack src={resolveAsset(musicSrc)!} />}
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
        defaultProps={
          {
            scenes: [],
            captionStyle: "clean",
            voiceoverSrc: null,
            musicSrc: null,
            allWords: [],
            captionAccentColor: "#38A169",
            captionChunkSize: 5,
            captionLingerS: 0.3,
          } as unknown as Record<string, unknown>
        }
      />
    </>
  );
};

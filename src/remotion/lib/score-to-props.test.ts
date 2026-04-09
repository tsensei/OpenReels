import { describe, expect, it, vi } from "vitest";
import type { ArchetypeConfig } from "../../schema/archetype.js";
import type { DirectorScore } from "../../schema/director-score.js";
import type { ResolvedAssets } from "./score-to-props.js";
import { getTotalDurationInFrames, mapScoreToProps } from "./score-to-props.js";

const makeWords = (start: number, end: number) => [
  { word: "hello", start, end: start + (end - start) / 2 },
  { word: "world", start: start + (end - start) / 2, end },
];

const baseScore: DirectorScore = {
  emotional_arc: "curiosity-to-wisdom",
  archetype: "editorial_caricature",
  music_mood: "epic_cinematic",
  scenes: [
    {
      visual_type: "text_card",
      visual_prompt: "Title",
      motion: "static",
      script_line: "Scene one.",
      transition: null,
    },
    {
      visual_type: "ai_image",
      visual_prompt: "Image",
      motion: "zoom_in",
      script_line: "Scene two.",
      transition: null,
    },
    {
      visual_type: "stock_video",
      visual_prompt: "Video",
      motion: "static",
      script_line: "Scene three.",
      transition: null,
    },
  ],
};

const baseAssets: ResolvedAssets = {
  sceneAssets: [null, "/images/scene2.png", "/videos/scene3.mp4"],
  voiceoverPath: "/audio/voiceover.mp3",
  musicPath: "/audio/music.mp3",
  sceneWords: [makeWords(0, 3), makeWords(3, 6), makeWords(6, 9)],
  allWords: [
    { word: "Scene", start: 0, end: 1 },
    { word: "one", start: 1, end: 2 },
    { word: "Scene", start: 3, end: 4 },
    { word: "two", start: 4, end: 5 },
    { word: "Scene", start: 6, end: 7 },
    { word: "three", start: 7, end: 9 },
  ],
  sceneSourceDurations: [null, null, 5],
};

describe("mapScoreToProps", () => {
  it("maps basic scene properties correctly", () => {
    const props = mapScoreToProps(baseScore, baseAssets);
    expect(props.scenes).toHaveLength(3);
    expect(props.scenes[0]!.visualType).toBe("text_card");
    expect(props.scenes[1]!.visualType).toBe("ai_image");
    expect(props.scenes[1]!.assetSrc).toBe("/images/scene2.png");
    expect(props.scenes[0]!.motion).toBe("static");
    expect(props.scenes[1]!.motion).toBe("zoom_in");
  });

  it("passes scriptLine from score to scene props", () => {
    const props = mapScoreToProps(baseScore, baseAssets);
    expect(props.scenes[0]!.scriptLine).toBe("Scene one.");
    expect(props.scenes[1]!.scriptLine).toBe("Scene two.");
    expect(props.scenes[2]!.scriptLine).toBe("Scene three.");
  });

  it("calculates scene duration from word timestamps with padding", () => {
    const props = mapScoreToProps(baseScore, baseAssets, 30);
    // Scene 1: words from 0 to 3 = 3s + 0.5s padding = 3.5s = 105 frames
    expect(props.scenes[0]!.durationInFrames).toBe(105);
  });

  it("uses minimum 2 second duration for scenes with short voiceover", () => {
    const shortAssets = {
      ...baseAssets,
      sceneWords: [makeWords(0, 0.5), makeWords(0.5, 1), makeWords(1, 1.5)],
    };
    const props = mapScoreToProps(baseScore, shortAssets, 30);
    // 0.5s voiceover + 0.5s padding = 1.0s, but min is 2s = 60 frames
    expect(props.scenes[0]!.durationInFrames).toBe(60);
  });

  it("passes archetype config to scene props", () => {
    const props = mapScoreToProps(baseScore, baseAssets);
    expect(props.scenes[0]!.colorPalette).toBeDefined();
    expect(props.scenes[0]!.textCardFont).toBeTruthy();
    expect(typeof props.scenes[0]!.motionIntensity).toBe("number");
    expect(props.captionStyle).toBe("bold_outline");
  });

  it("uses scene transition when explicitly set", () => {
    const score: DirectorScore = {
      ...baseScore,
      scenes: baseScore.scenes.map((s, i) => ({
        ...s,
        transition: i === 0 ? ("crossfade" as const) : i === 1 ? ("wipe" as const) : null,
      })),
    };
    const props = mapScoreToProps(score, baseAssets);
    expect(props.scenes[0]!.transition).toBe("crossfade");
    expect(props.scenes[1]!.transition).toBe("wipe");
  });

  it("falls back to archetype default when scene transition is undefined", () => {
    // editorial_caricature has defaultTransition: "slide_left"
    const props = mapScoreToProps(baseScore, baseAssets);
    expect(props.scenes[0]!.transition).toBe("slide_left");
    expect(props.scenes[1]!.transition).toBe("slide_left");
  });

  it("falls back to 'none' when archetype has no default transition", async () => {
    const archetypeRegistry = await import("../../config/archetype-registry.js");
    const originalGetArchetype = archetypeRegistry.getArchetype;
    // Temporarily mock getArchetype to return a config without defaultTransition
    const noTransitionConfig: ArchetypeConfig = {
      scenePacing: "moderate",
      captionStyle: "clean",
      colorPalette: { background: "#000", accent: "#fff", text: "#fff" },
      textCardFont: "Inter",
      motionIntensity: 1.0,
      artStyle: "test",
      lighting: "test",
      compositionRules: "test",
      culturalMarkers: "test",
      mood: "test",
      antiArtifactGuidance: "test",
      visualColorPalette: ["white"],
    };
    vi.spyOn(archetypeRegistry, "getArchetype").mockReturnValue(noTransitionConfig);
    try {
      const props = mapScoreToProps(baseScore, baseAssets);
      // No scene.transition set, no archetype.defaultTransition -> falls to "none"
      expect(props.scenes[0]!.transition).toBe("none");
    } finally {
      vi.spyOn(archetypeRegistry, "getArchetype").mockImplementation(originalGetArchetype);
    }
  });

  it("uses archetype transitionDurationFrames", () => {
    // editorial_caricature has transitionDurationFrames: 12
    const props = mapScoreToProps(baseScore, baseAssets);
    expect(props.scenes[0]!.transitionDurationFrames).toBe(12);
  });

  it("remaps ai_video to ai_image when asset is a fallback PNG", () => {
    const score: DirectorScore = {
      ...baseScore,
      scenes: [
        {
          visual_type: "ai_video",
          visual_prompt: "Rocket launch",
          motion: "static",
          script_line: "Watch the launch.",
          transition: null,
        },
      ],
    };
    const assets: ResolvedAssets = {
      ...baseAssets,
      sceneAssets: ["/images/scene-0-ai.png"],
      sceneWords: [makeWords(0, 3)],
    };
    const props = mapScoreToProps(score, assets);
    expect(props.scenes[0]!.visualType).toBe("ai_image");
    // motion="static" should be forced to "zoom_in" on fallback
    expect(props.scenes[0]!.motion).toBe("zoom_in");
  });

  it("maps caption accent color from archetype palette", () => {
    const props = mapScoreToProps(baseScore, baseAssets);
    // editorial_caricature has colorPalette.accent defined
    expect(props.captionAccentColor).toBeTruthy();
    expect(typeof props.captionAccentColor).toBe("string");
  });

  it("defaults captionChunkSize to 5 when archetype has no override", () => {
    const props = mapScoreToProps(baseScore, baseAssets);
    expect(props.captionChunkSize).toBe(5);
  });

  it("defaults captionLingerS to 0.3 when archetype has no override", () => {
    const props = mapScoreToProps(baseScore, baseAssets);
    expect(props.captionLingerS).toBe(0.3);
  });

  it("preserves ai_video type when asset is a video file", () => {
    const score: DirectorScore = {
      ...baseScore,
      scenes: [
        {
          visual_type: "ai_video",
          visual_prompt: "Rocket launch",
          motion: "static",
          script_line: "Watch the launch.",
          transition: null,
        },
      ],
    };
    const assets: ResolvedAssets = {
      ...baseAssets,
      sceneAssets: ["/videos/scene-0-ai-video.mp4"],
      sceneWords: [makeWords(0, 3)],
      sceneSourceDurations: [6],
    };
    const props = mapScoreToProps(score, assets);
    expect(props.scenes[0]!.visualType).toBe("ai_video");
    expect(props.scenes[0]!.motion).toBe("static");
  });
});

describe("getTotalDurationInFrames", () => {
  it("returns sum of scene durations when no transitions", () => {
    const props = mapScoreToProps(baseScore, baseAssets, 30);
    props.scenes.forEach((s) => {
      s.transition = "none";
    });
    const total = getTotalDurationInFrames(props, 30);
    const sum = props.scenes.reduce((acc, s) => acc + s.durationInFrames, 0);
    expect(total).toBe(sum);
  });

  it("subtracts transition overlaps from total duration", () => {
    const props = mapScoreToProps(baseScore, baseAssets, 30);
    props.scenes[0]!.transition = "crossfade";
    props.scenes[0]!.transitionDurationFrames = 15;
    props.scenes[1]!.transition = "wipe";
    props.scenes[1]!.transitionDurationFrames = 10;
    props.scenes[2]!.transition = "none";

    const sum = props.scenes.reduce((acc, s) => acc + s.durationInFrames, 0);
    const total = getTotalDurationInFrames(props, 30);
    // Overlaps: 15 + 10 = 25 frames
    expect(total).toBe(sum - 25);
  });

  it("extends last scene when overlap causes voiceover truncation", () => {
    const props = mapScoreToProps(baseScore, baseAssets, 30);
    props.scenes[0]!.transition = "crossfade";
    props.scenes[0]!.transitionDurationFrames = 60;
    props.scenes[1]!.transition = "crossfade";
    props.scenes[1]!.transitionDurationFrames = 60;

    const lastSceneBefore = props.scenes[2]!.durationInFrames;
    const total = getTotalDurationInFrames(props, 30);

    // Voiceover ends at 9 seconds = 270 frames
    const voiceoverEnd = Math.ceil(9 * 30);
    expect(total).toBeGreaterThanOrEqual(voiceoverEnd);
    expect(props.scenes[2]!.durationInFrames).toBeGreaterThan(lastSceneBefore);
  });

  it("handles empty words array without clamping", () => {
    const props = mapScoreToProps(
      baseScore,
      {
        ...baseAssets,
        allWords: [],
        sceneWords: [[], [], []],
      },
      30,
    );
    props.scenes.forEach((s) => {
      s.transition = "none";
    });
    props.scenes[0]!.transition = "crossfade";
    props.scenes[0]!.transitionDurationFrames = 15;

    const sum = props.scenes.reduce((acc, s) => acc + s.durationInFrames, 0);
    const total = getTotalDurationInFrames(props, 30);
    expect(total).toBe(sum - 15);
  });

  it("does not compound last scene duration on double invocation", () => {
    const props = mapScoreToProps(baseScore, baseAssets, 30);
    props.scenes[0]!.transition = "crossfade";
    props.scenes[0]!.transitionDurationFrames = 60;
    props.scenes[1]!.transition = "crossfade";
    props.scenes[1]!.transitionDurationFrames = 60;

    const first = getTotalDurationInFrames(props, 30);
    const lastSceneAfterFirst = props.scenes[2]!.durationInFrames;

    // Second call on same props — should NOT grow the last scene further
    const second = getTotalDurationInFrames(props, 30);
    expect(second).toBe(first);
    expect(props.scenes[2]!.durationInFrames).toBe(lastSceneAfterFirst);
  });
});

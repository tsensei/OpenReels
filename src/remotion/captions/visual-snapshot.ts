/**
 * Visual snapshot generator for caption styles.
 *
 * Renders each of the 7 caption styles at 3 key frames using Remotion's
 * bundle() + renderStill(). Saves PNGs to __snapshots__/ for visual comparison.
 *
 * Usage:
 *   npx tsx src/remotion/captions/visual-snapshot.ts
 *
 * This is NOT a vitest test — it requires a full Remotion bundle + Chromium.
 * Run it manually during development or in CI as a separate step.
 */
import { bundle } from "@remotion/bundler";
import { renderStill } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const STYLES = [
  "clean",
  "bold_outline",
  "karaoke_sweep",
  "color_highlight",
  "gradient_rise",
  "block_impact",
  "box_highlight",
] as const;

// Test frames: word 1 unspoken (frame 0), word 3 active (frame 60), word 5 spoken (frame 120)
const TEST_FRAMES = [0, 60, 120] as const;

const TEST_WORDS = [
  { word: "The", start: 0.5, end: 0.8 },
  { word: "ocean", start: 0.9, end: 1.3 },
  { word: "covers", start: 1.4, end: 1.8 },
  { word: "seventy", start: 1.9, end: 2.4 },
  { word: "percent", start: 2.5, end: 3.0 },
];

const SNAPSHOT_DIR = path.join(import.meta.dirname, "__snapshots__");

async function main() {
  console.log("Bundling Remotion project...");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(import.meta.dirname, "../compositions/OpenReelsVideo.tsx"),
    webpackOverride: (config) => config,
  });

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  for (const style of STYLES) {
    for (const frame of TEST_FRAMES) {
      const outputPath = path.join(SNAPSHOT_DIR, `${style}-frame-${frame}.png`);
      console.log(`Rendering ${style} at frame ${frame}...`);
      await renderStill({
        composition: {
          id: "OpenReelsVideo",
          width: 1080,
          height: 1920,
          fps: 30,
          durationInFrames: 300,
        } as Parameters<typeof renderStill>[0]["composition"],
        serveUrl: bundleLocation,
        frame,
        output: outputPath,
        inputProps: {
          scenes: [],
          captionStyle: style,
          voiceoverSrc: null,
          musicSrc: null,
          allWords: TEST_WORDS,
          captionAccentColor: "#38A169",
          captionChunkSize: 5,
          captionLingerS: 0.3,
        },
      });
      console.log(`  -> ${outputPath}`);
    }
  }

  console.log(`\nDone! ${STYLES.length * TEST_FRAMES.length} snapshots saved to ${SNAPSHOT_DIR}`);
}

main().catch((err) => {
  console.error("Snapshot generation failed:", err);
  process.exit(1);
});

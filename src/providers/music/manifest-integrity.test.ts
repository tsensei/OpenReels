import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const MUSIC_DIR = path.join(process.cwd(), "assets", "music");
const MANIFEST_PATH = path.join(process.cwd(), "assets", "music-manifest.json");

describe("music manifest integrity", () => {
  it("manifest file exists and is valid JSON", () => {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const manifest = JSON.parse(raw);
    expect(manifest.tracks).toBeDefined();
    expect(Array.isArray(manifest.tracks)).toBe(true);
    expect(manifest.tracks.length).toBeGreaterThan(0);
  });

  it("every manifest entry has a corresponding MP3 file", () => {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const manifest = JSON.parse(raw);
    const missing: string[] = [];

    for (const track of manifest.tracks) {
      const filePath = path.join(MUSIC_DIR, track.filename);
      if (!fs.existsSync(filePath)) {
        missing.push(track.filename);
      }
    }

    expect(missing).toEqual([]);
  });

  it("every track has required fields", () => {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const manifest = JSON.parse(raw);

    for (const track of manifest.tracks) {
      expect(track.id).toBeDefined();
      expect(track.mood).toBeDefined();
      expect(track.filename).toBeDefined();
      expect(track.durationSec).toBeGreaterThan(0);
    }
  });

  it("all mood values in manifest are valid MusicMood enum values", () => {
    const validMoods = [
      "epic_cinematic", "tense_electronic", "chill_lofi", "uplifting_pop",
      "mysterious_ambient", "warm_acoustic", "dark_cinematic", "dreamy_ethereal",
    ];
    const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const manifest = JSON.parse(raw);

    for (const track of manifest.tracks) {
      expect(validMoods).toContain(track.mood);
    }
  });
});

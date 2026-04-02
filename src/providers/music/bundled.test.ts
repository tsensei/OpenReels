import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicMood } from "../../schema/director-score.js";
import { _resetCache, selectTrack, validateManifest } from "./bundled.js";

// Mock fs to avoid reading actual files during tests
vi.mock("node:fs");

const mockManifest = {
  tracks: [
    { id: "epic-01", mood: "epic_cinematic", filename: "epic-cinematic-01.mp3", durationSec: 90, source: "pixabay", sourceId: 1, license: "Pixabay License" },
    { id: "epic-02", mood: "epic_cinematic", filename: "epic-cinematic-02.mp3", durationSec: 90, source: "pixabay", sourceId: 2, license: "Pixabay License" },
    { id: "chill-01", mood: "chill_lofi", filename: "chill-lofi-01.mp3", durationSec: 90, source: "pixabay", sourceId: 3, license: "Pixabay License" },
    { id: "warm-01", mood: "warm_acoustic", filename: "warm-acoustic-01.mp3", durationSec: 90, source: "pixabay", sourceId: 4, license: "Pixabay License" },
  ],
};

beforeEach(() => {
  _resetCache();
  vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockManifest));
  vi.mocked(fs.existsSync).mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("selectTrack", () => {
  it("returns a track matching the requested mood", () => {
    const result = selectTrack("epic_cinematic" as MusicMood);
    expect(result).not.toBeNull();
    expect(result!.mood).toBe("epic_cinematic");
    expect(result!.requestedMood).toBe("epic_cinematic");
    expect(result!.fallback).toBe(false);
  });

  it("falls back to any track when requested mood has no tracks", () => {
    const result = selectTrack("dark_cinematic" as MusicMood);
    expect(result).not.toBeNull();
    expect(result!.requestedMood).toBe("dark_cinematic");
    expect(result!.fallback).toBe(true);
  });

  it("returns null when manifest has no tracks", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ tracks: [] }));
    const result = selectTrack("epic_cinematic" as MusicMood);
    expect(result).toBeNull();
  });

  it("includes the absolute file path in the result", () => {
    const result = selectTrack("chill_lofi" as MusicMood);
    expect(result).not.toBeNull();
    expect(result!.filePath).toContain("assets");
    expect(result!.filePath).toContain("music");
    expect(result!.filePath).toContain("chill-lofi-01.mp3");
  });
});

describe("validateManifest", () => {
  it("returns valid when all files exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = validateManifest();
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("returns missing files when some are absent", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return !String(p).includes("epic-cinematic-02");
    });
    const result = validateManifest();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("epic-cinematic-02.mp3");
  });

  it("throws when manifest file is missing", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(() => validateManifest()).toThrow("ENOENT");
  });
});

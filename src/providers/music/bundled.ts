import * as fs from "node:fs";
import * as path from "node:path";
import type { MusicMood } from "../../schema/director-score.js";

interface ManifestTrack {
  id: string;
  mood: string;
  filename: string;
  durationSec: number;
  source: string;
  sourceId: number;
  license: string;
}

interface MusicManifest {
  tracks: ManifestTrack[];
}

export interface MusicSelection {
  trackId: string;
  filename: string;
  filePath: string;
  mood: string;
  requestedMood: string;
  fallback: boolean;
}

const MUSIC_DIR = path.join(process.cwd(), "assets", "music");
const MANIFEST_PATH = path.join(process.cwd(), "assets", "music-manifest.json");

let cachedManifest: MusicManifest | null = null;

/** Reset the cached manifest (for testing only) */
export function _resetCache(): void {
  cachedManifest = null;
}

function loadManifest(): MusicManifest {
  if (cachedManifest) return cachedManifest;
  const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
  cachedManifest = JSON.parse(raw) as MusicManifest;
  return cachedManifest;
}

/**
 * Validate that every track in the manifest has a corresponding MP3 file on disk.
 * Call at startup to catch broken clones early.
 */
export function validateManifest(): { valid: boolean; missing: string[] } {
  const manifest = loadManifest();
  const missing: string[] = [];

  for (const track of manifest.tracks) {
    const filePath = path.join(MUSIC_DIR, track.filename);
    if (!fs.existsSync(filePath)) {
      missing.push(track.filename);
    }
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Select a music track for the given mood.
 * - Valid mood with tracks available: random pick from that mood.
 * - Valid mood with empty pool (missing files): fallback to random from any mood.
 * - Returns null only if the entire manifest is empty.
 */
export function selectTrack(mood: MusicMood): MusicSelection | null {
  const manifest = loadManifest();

  // Filter tracks for the requested mood
  const moodTracks = manifest.tracks.filter((t) => t.mood === mood);

  if (moodTracks.length > 0) {
    const track = moodTracks[Math.floor(Math.random() * moodTracks.length)]!;
    return {
      trackId: track.id,
      filename: track.filename,
      filePath: path.join(MUSIC_DIR, track.filename),
      mood: track.mood,
      requestedMood: mood,
      fallback: false,
    };
  }

  // Fallback: pick from any available mood
  if (manifest.tracks.length > 0) {
    const track = manifest.tracks[Math.floor(Math.random() * manifest.tracks.length)]!;
    return {
      trackId: track.id,
      filename: track.filename,
      filePath: path.join(MUSIC_DIR, track.filename),
      mood: track.mood,
      requestedMood: mood,
      fallback: true,
    };
  }

  return null;
}

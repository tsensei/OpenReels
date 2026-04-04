import type { MusicMood } from "../../schema/director-score.js";
import type { MusicProvider, MusicResult } from "../../schema/providers.js";
import { selectTrack } from "./bundled.js";

/**
 * Adapter wrapping the bundled royalty-free track library behind the MusicProvider interface.
 * Ignores the prompt parameter — selects tracks by mood enum only.
 */
export class BundledMusic implements MusicProvider {
  async generate(_prompt: string, mood: MusicMood): Promise<MusicResult> {
    const selection = selectTrack(mood);
    if (!selection) throw new Error("No bundled tracks available");
    return { filePath: selection.filePath };
  }
}

import { describe, expect, it, vi } from "vitest";
import { BundledMusic } from "./bundled-adapter.js";
import * as bundled from "./bundled.js";
import type { MusicMood } from "../../schema/director-score.js";

vi.mock("./bundled.js", () => ({
  selectTrack: vi.fn(),
}));

describe("BundledMusic", () => {
  it("delegates to selectTrack and returns filePath", async () => {
    vi.mocked(bundled.selectTrack).mockReturnValue({
      trackId: "track-1",
      filename: "epic.mp3",
      filePath: "/assets/music/epic.mp3",
      mood: "epic_cinematic",
      requestedMood: "epic_cinematic",
      fallback: false,
    });

    const adapter = new BundledMusic();
    const result = await adapter.generate("ignored prompt", "epic_cinematic" as MusicMood);

    expect(result.filePath).toBe("/assets/music/epic.mp3");
    expect(bundled.selectTrack).toHaveBeenCalledWith("epic_cinematic");
  });

  it("throws when no tracks available", async () => {
    vi.mocked(bundled.selectTrack).mockReturnValue(null);

    const adapter = new BundledMusic();
    await expect(adapter.generate("", "chill_lofi" as MusicMood)).rejects.toThrow(
      "No bundled tracks available",
    );
  });
});

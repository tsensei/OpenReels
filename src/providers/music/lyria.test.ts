import * as fsp from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LyriaMusic, _sanitizePrompt } from "./lyria.js";
import type { MusicMood } from "../../schema/director-score.js";

// Mock @google/genai — must return stable object reference for models
const mockGenerateContent = vi.fn();
const mockModels = { generateContent: mockGenerateContent };
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: mockModels,
  })),
}));

describe("LyriaMusic", () => {
  let lyria: LyriaMusic;

  beforeEach(() => {
    lyria = new LyriaMusic("test-api-key");
  });

  afterEach(() => {
    mockGenerateContent.mockReset();
  });

  it("throws without API key", () => {
    const origKey = process.env["GOOGLE_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
    expect(() => new LyriaMusic()).toThrow("GOOGLE_API_KEY is required");
    if (origKey) process.env["GOOGLE_API_KEY"] = origKey;
  });

  it("generates music from Lyria API response", async () => {
    const fakeAudio = Buffer.from("fake-audio-data").toString("base64");
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { data: fakeAudio, mimeType: "audio/mp3" } },
              { text: "BPM: 70, Sections: intro, build, peak" },
            ],
          },
        },
      ],
    });

    const result = await lyria.generate("test prompt", "epic_cinematic" as MusicMood);

    expect(result.filePath).toMatch(/openreels-lyria-.*\.mp3$/);
    expect(result.metadata?.lyriaResponse).toContain("BPM: 70");

    // Verify file was written
    const content = await fsp.readFile(result.filePath);
    expect(content.toString()).toBe("fake-audio-data");

    // Cleanup
    await fsp.unlink(result.filePath);
  });

  it("throws when no content returned", async () => {
    mockGenerateContent.mockResolvedValue({ candidates: [] });

    await expect(lyria.generate("test", "epic_cinematic" as MusicMood)).rejects.toThrow(
      "Lyria returned no content",
    );
  });

  it("throws when no audio parts in response", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "only text" }] } }],
    });

    await expect(lyria.generate("test", "epic_cinematic" as MusicMood)).rejects.toThrow(
      "Lyria returned no audio data",
    );
  });

  it("retries with sanitized prompt on safety filter error", async () => {
    const fakeAudio = Buffer.from("audio").toString("base64");

    // First call: safety filter error
    mockGenerateContent.mockRejectedValueOnce(new Error("Content blocked by safety filter"));
    // Second call: success
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ inlineData: { data: fakeAudio, mimeType: "audio/mp3" } }] } }],
    });

    const result = await lyria.generate("oppressive dark intense music", "dark_cinematic" as MusicMood);
    expect(result.filePath).toMatch(/\.mp3$/);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);

    // Cleanup
    await fsp.unlink(result.filePath);
  });

  it("throws after safety filter retry also fails", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Content blocked by safety policy"));

    await expect(lyria.generate("test", "dark_cinematic" as MusicMood)).rejects.toThrow(
      "safety policy",
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(2); // original + 1 retry
  });

  it("does not retry on non-safety errors", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Rate limit exceeded"));

    await expect(lyria.generate("test", "epic_cinematic" as MusicMood)).rejects.toThrow(
      "Rate limit exceeded",
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1); // no retry
  });
});

describe("sanitizePrompt", () => {
  it("replaces intense adjectives with 'restrained'", () => {
    const result = _sanitizePrompt("Dark oppressive heavy atmosphere with aggressive drums");
    expect(result).not.toContain("oppressive");
    expect(result).not.toContain("aggressive");
    expect(result).toContain("restrained");
    expect(result).toContain("atmosphere");
    expect(result).toContain("drums");
  });

  it("preserves musical structure", () => {
    const prompt = "Solo shakuhachi flute at 70 BPM with sustained pads";
    expect(_sanitizePrompt(prompt)).toBe(prompt);
  });
});

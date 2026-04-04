import { describe, expect, it, vi } from "vitest";

// Mock @google/genai before import
vi.mock("@google/genai", () => {
  const generateVideos = vi.fn();
  const getVideosOperation = vi.fn();
  const download = vi.fn();

  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateVideos },
      operations: { getVideosOperation },
      files: { download },
    })),
    __mocks: { generateVideos, getVideosOperation, download },
  };
});

import * as fs from "node:fs";
import { GeminiVideo } from "./gemini.js";

// Access mocks
const { __mocks } = await import("@google/genai") as any;
const { generateVideos, getVideosOperation, download } = __mocks;

describe("GeminiVideo", () => {
  it("throws without API key", () => {
    const orig = process.env["GOOGLE_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
    expect(() => new GeminiVideo("veo-3.1-lite-generate-preview")).toThrow("GOOGLE_API_KEY");
    if (orig) process.env["GOOGLE_API_KEY"] = orig;
  });

  it("constructs with explicit API key", () => {
    expect(() => new GeminiVideo("veo-3.1-lite-generate-preview", "test-key")).not.toThrow();
  });

  it("exposes supported durations", () => {
    const provider = new GeminiVideo("veo-3.1-lite-generate-preview", "test-key");
    expect(provider.supportedDurations).toEqual([4, 6, 8]);
  });

  it("generates video on happy path", async () => {
    const provider = new GeminiVideo("veo-3.1-lite-generate-preview", "test-key");

    generateVideos.mockResolvedValueOnce({
      done: true,
      response: {
        generatedVideos: [{ video: { uri: "gs://bucket/video.mp4" } }],
      },
    });
    download.mockImplementationOnce(async ({ downloadPath }: { downloadPath: string }) => {
      fs.writeFileSync(downloadPath, "fake-mp4-data");
    });

    const result = await provider.generate({
      sourceImage: Buffer.from("fake-image"),
      prompt: "A rocket launching",
      durationSeconds: 6,
    });

    expect(result.filePath).toContain("openreels-veo-");
    expect(result.durationSeconds).toBe(6);
    expect(generateVideos).toHaveBeenCalledOnce();

    // Clean up temp file
    if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
  });

  it("throws on empty response", async () => {
    const provider = new GeminiVideo("veo-3.1-lite-generate-preview", "test-key");

    generateVideos.mockResolvedValueOnce({ done: true, response: { generatedVideos: [] } });

    await expect(
      provider.generate({
        sourceImage: Buffer.from("fake-image"),
        prompt: "test",
      }),
    ).rejects.toThrow("no generated video");
  });

  it("throws on operation error", async () => {
    const provider = new GeminiVideo("veo-3.1-lite-generate-preview", "test-key");

    generateVideos.mockResolvedValueOnce({
      done: true,
      error: { message: "content filtered" },
      response: null,
    });

    await expect(
      provider.generate({
        sourceImage: Buffer.from("fake-image"),
        prompt: "test",
      }),
    ).rejects.toThrow("content filtered");
  });
});

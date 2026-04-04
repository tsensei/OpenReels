import { describe, expect, it, vi } from "vitest";

// Mock @fal-ai/client before import
const mockSubscribe = vi.fn();
const mockUpload = vi.fn();

vi.mock("@fal-ai/client", () => ({
  createFalClient: vi.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    storage: { upload: mockUpload },
  })),
}));

// Mock fetch for video download
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { FalVideo } from "./fal.js";

describe("FalVideo", () => {
  it("throws without API key", () => {
    const orig = process.env["FAL_API_KEY"];
    delete process.env["FAL_API_KEY"];
    expect(() => new FalVideo()).toThrow("FAL_API_KEY");
    if (orig) process.env["FAL_API_KEY"] = orig;
  });

  it("constructs with explicit API key", () => {
    expect(() => new FalVideo(undefined, "test-key")).not.toThrow();
  });

  it("exposes supported durations", () => {
    const provider = new FalVideo(undefined, "test-key");
    expect(provider.supportedDurations).toEqual([5, 10]);
  });

  it("generates video on happy path", async () => {
    const provider = new FalVideo(undefined, "test-key");

    mockUpload.mockResolvedValueOnce("https://fal.storage/image-123.png");
    mockSubscribe.mockResolvedValueOnce({
      data: {
        video: { url: "https://fal.storage/video-456.mp4" },
      },
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });

    const result = await provider.generate({
      sourceImage: Buffer.from("fake-image"),
      prompt: "A rocket launching",
      durationSeconds: 5,
    });

    expect(result.filePath).toContain("openreels-fal-");
    expect(result.durationSeconds).toBe(5);
    expect(mockUpload).toHaveBeenCalledOnce();
    expect(mockSubscribe).toHaveBeenCalledOnce();

    // Clean up temp file
    const fs = await import("node:fs");
    if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
  });

  it("throws on empty response", async () => {
    const provider = new FalVideo(undefined, "test-key");

    mockUpload.mockResolvedValueOnce("https://fal.storage/image.png");
    mockSubscribe.mockResolvedValueOnce({ data: {} });

    await expect(
      provider.generate({
        sourceImage: Buffer.from("fake-image"),
        prompt: "test",
      }),
    ).rejects.toThrow("no video URL");
  });

  it("throws on download failure", async () => {
    const provider = new FalVideo(undefined, "test-key");

    mockUpload.mockResolvedValueOnce("https://fal.storage/image.png");
    mockSubscribe.mockResolvedValueOnce({
      data: { video: { url: "https://fal.storage/video.mp4" } },
    });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      provider.generate({
        sourceImage: Buffer.from("fake-image"),
        prompt: "test",
      }),
    ).rejects.toThrow("Failed to download fal.ai video: 500");
  });
});

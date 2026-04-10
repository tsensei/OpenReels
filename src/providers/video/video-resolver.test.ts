import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoProvider, VideoResult, LLMProvider, LLMUsage } from "../../schema/providers.js";
import type { ArchetypeConfig } from "../../schema/archetype.js";
import type { PipelineCallbacks } from "../../pipeline/utils.js";
import type { DirectorScore } from "../../schema/director-score.js";

// Mock image-prompter
vi.mock("../../agents/image-prompter.js", () => ({
  optimizeImagePrompt: vi.fn().mockResolvedValue({
    prompt: "A rocket launching with dramatic fire and smoke",
    usage: { inputTokens: 100, outputTokens: 50 },
  }),
}));

import { resolveAIVideo } from "./video-resolver.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openreels-test-"));
  fs.mkdirSync(path.join(tmpDir, "assets"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeProvider(opts?: { shouldFail?: boolean; durations?: number[] }): VideoProvider {
  return {
    supportedDurations: opts?.durations ?? [4, 6, 8],
    generate: opts?.shouldFail
      ? vi.fn().mockRejectedValue(new Error("Provider timeout"))
      : vi.fn().mockImplementation(async () => {
          // Create a real temp file so copyFileSync works
          const tmpFile = path.join(os.tmpdir(), `test-video-${Date.now()}.mp4`);
          fs.writeFileSync(tmpFile, "fake-mp4-data");
          return { filePath: tmpFile, durationSeconds: 6 } as VideoResult;
        }),
  };
}

const mockScene: DirectorScore["scenes"][number] = {
  visual_type: "ai_video",
  visual_prompt: "A rocket launching",
  motion: "static",
  script_line: "Watch as the rocket lifts off.",
  transition: null,
};

const mockImageResult = {
  path: "/tmp/test-image.png",
  buffer: Buffer.from("fake-image-data"),
  usage: { inputTokens: 200, outputTokens: 100 } as LLMUsage,
};

const mockArchetype = {
  artStyle: "cinematic",
  visualColorPalette: ["#000", "#FFF"],
  lighting: "dramatic",
  compositionRules: "rule of thirds",
  culturalMarkers: "none",
  mood: "epic",
  antiArtifactGuidance: "no artifacts",
} as unknown as ArchetypeConfig;

const mockCallbacks: PipelineCallbacks = {
  onProgress: vi.fn(),
};

const mockLlm = {} as LLMProvider;

describe("resolveAIVideo", () => {
  it("returns video on primary provider success", async () => {
    const primary = makeProvider();
    const result = await resolveAIVideo(mockScene, mockImageResult, 0, path.join(tmpDir, "assets"), {
      videoProviders: [primary],
      llm: mockLlm,
      archetype: mockArchetype,
      callbacks: mockCallbacks,
    });

    expect(result.videoResolution.method).toBe("image_to_video");
    expect(result.durationSeconds).toBe(6);
    expect(primary.generate).toHaveBeenCalledOnce();
  });

  it("falls back to secondary provider on primary failure", async () => {
    const primary = makeProvider({ shouldFail: true });
    const secondary = makeProvider();

    const result = await resolveAIVideo(mockScene, mockImageResult, 0, path.join(tmpDir, "assets"), {
      videoProviders: [primary, secondary],
      llm: mockLlm,
      archetype: mockArchetype,
      callbacks: mockCallbacks,
    });

    expect(result.videoResolution.method).toBe("image_to_video");
    expect(primary.generate).toHaveBeenCalledOnce();
    expect(secondary.generate).toHaveBeenCalledOnce();
  });

  it("falls back to AI image when all providers fail", async () => {
    const primary = makeProvider({ shouldFail: true });
    const secondary = makeProvider({ shouldFail: true });

    const result = await resolveAIVideo(mockScene, mockImageResult, 0, path.join(tmpDir, "assets"), {
      videoProviders: [primary, secondary],
      llm: mockLlm,
      archetype: mockArchetype,
      callbacks: mockCallbacks,
    });

    expect(result.videoResolution.method).toBe("image_fallback");
    expect(result.path).toBe(mockImageResult.path);
    expect(result.durationSeconds).toBeNull();
    expect(result.videoResolution.error).toContain("Provider timeout");
  });

  it("emits video_fallback progress event on all-fail", async () => {
    const primary = makeProvider({ shouldFail: true });
    const progressFn = vi.fn();

    await resolveAIVideo(mockScene, mockImageResult, 0, "/tmp/assets", {
      videoProviders: [primary],
      llm: mockLlm,
      archetype: mockArchetype,
      callbacks: { onProgress: progressFn },
    });

    const fallbackCall = progressFn.mock.calls.find(
      (c: unknown[]) => (c[1] as Record<string, unknown>)?.type === "video_fallback",
    );
    expect(fallbackCall).toBeDefined();
  });

  it("emits video_image_ready progress event", async () => {
    const primary = makeProvider();
    const progressFn = vi.fn();

    await resolveAIVideo(mockScene, mockImageResult, 0, "/tmp/assets", {
      videoProviders: [primary],
      llm: mockLlm,
      archetype: mockArchetype,
      callbacks: { onProgress: progressFn },
    });

    const readyCall = progressFn.mock.calls.find(
      (c: unknown[]) => (c[1] as Record<string, unknown>)?.type === "video_image_ready",
    );
    expect(readyCall).toBeDefined();
  });

  it("passes negativePrompt combining defaults and archetype antiArtifactGuidance", async () => {
    const primary = makeProvider();
    await resolveAIVideo(mockScene, mockImageResult, 0, path.join(tmpDir, "assets"), {
      videoProviders: [primary],
      llm: mockLlm,
      archetype: mockArchetype,
      callbacks: mockCallbacks,
    });

    const generateCall = (primary.generate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(generateCall.negativePrompt).toContain("blur");
    expect(generateCall.negativePrompt).toContain("flickering");
    expect(generateCall.negativePrompt).toContain("no artifacts");
  });

  it("uses defaults only when antiArtifactGuidance is empty", async () => {
    const primary = makeProvider();
    const emptyArchetype = { ...mockArchetype, antiArtifactGuidance: "" } as unknown as ArchetypeConfig;

    await resolveAIVideo(mockScene, mockImageResult, 0, path.join(tmpDir, "assets"), {
      videoProviders: [primary],
      llm: mockLlm,
      archetype: emptyArchetype,
      callbacks: mockCallbacks,
    });

    const generateCall = (primary.generate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(generateCall.negativePrompt).toContain("blur");
    expect(generateCall.negativePrompt).not.toContain(", ,");
    expect(generateCall.negativePrompt).not.toMatch(/, $/);
    expect(generateCall.negativePrompt).toBe(generateCall.negativePrompt.trim());
  });

  it("includes motionPrompt and negativePrompt in VideoResolution metadata", async () => {
    const primary = makeProvider();
    const result = await resolveAIVideo(mockScene, mockImageResult, 0, path.join(tmpDir, "assets"), {
      videoProviders: [primary],
      llm: mockLlm,
      archetype: mockArchetype,
      callbacks: mockCallbacks,
    });

    expect(result.videoResolution.motionPrompt).toBeDefined();
    expect(result.videoResolution.motionPrompt).toContain("rocket");
    expect(result.videoResolution.negativePrompt).toBeDefined();
    expect(result.videoResolution.negativePrompt).toContain("blur");
  });

  it("uses raw visual_prompt as motion prompt when LLM optimization fails", async () => {
    const { optimizeImagePrompt } = await import("../../agents/image-prompter.js");
    (optimizeImagePrompt as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("LLM failed"));

    const primary = makeProvider();
    const result = await resolveAIVideo(mockScene, mockImageResult, 0, path.join(tmpDir, "assets"), {
      videoProviders: [primary],
      llm: mockLlm,
      archetype: mockArchetype,
      callbacks: mockCallbacks,
    });

    const generateCall = (primary.generate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(generateCall.prompt).toBe("A rocket launching");
    expect(result.videoResolution.motionPrompt).toBe("A rocket launching");
  });
});

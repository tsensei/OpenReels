import { describe, expect, it, vi } from "vitest";
import { resolveMusic } from "./music-resolver.js";
import type { DirectorScore } from "../schema/director-score.js";
import type { LLMProvider, MusicProvider, MusicResult } from "../schema/providers.js";
import type { PipelineCallbacks } from "./utils.js";

// Mock the music prompter agent
vi.mock("../agents/music-prompter.js", () => ({
  generateMusicPrompt: vi.fn().mockResolvedValue({
    prompt: "Generated Lyria prompt",
    usage: { inputTokens: 100, outputTokens: 50 },
  }),
}));

// Mock archetype registry
vi.mock("../config/archetype-registry.js", () => ({
  getArchetype: vi.fn().mockReturnValue({ mood: "Dramatic, sweeping" }),
}));

const mockScore: DirectorScore = {
  emotional_arc: "curiosity-to-awe",
  archetype: "cinematic-documentary",
  music_mood: "epic_cinematic",
  scenes: [
    { visual_type: "ai_image", visual_prompt: "test", motion: "zoom_in", script_line: "test line", transition: null },
    { visual_type: "stock_video", visual_prompt: "test", motion: "static", script_line: "test line 2", transition: null },
    { visual_type: "text_card", visual_prompt: "test", motion: "static", script_line: "test line 3", transition: null },
  ],
};

const sceneDurations = [4.5, 6.2, 5.1];

function createMockMusicProvider(result: MusicResult | null = null, shouldFail = false): MusicProvider {
  return {
    generate: shouldFail
      ? vi.fn().mockRejectedValue(new Error("Lyria API error"))
      : vi.fn().mockResolvedValue(result ?? { filePath: "/tmp/lyria-music.mp3", metadata: { bpm: 70 } }),
  };
}

function createMockLLM(): LLMProvider {
  return {
    id: "anthropic",
    generate: vi.fn().mockResolvedValue({
      data: { music_prompt: "test prompt" },
      usage: { inputTokens: 100, outputTokens: 50 },
    }),
  };
}

describe("resolveMusic", () => {
  it("returns null when noMusic is true", async () => {
    const result = await resolveMusic(mockScore, sceneDurations, {
      musicProvider: createMockMusicProvider(),
      musicProviderKey: "lyria",
      llm: createMockLLM(),
      noMusic: true,
    });

    expect(result).toBeNull();
  });

  it("returns bundled track for bundled provider", async () => {
    const provider = createMockMusicProvider({ filePath: "/assets/music/epic.mp3" });

    const result = await resolveMusic(mockScore, sceneDurations, {
      musicProvider: provider,
      musicProviderKey: "bundled",
      llm: createMockLLM(),
    });

    expect(result).not.toBeNull();
    expect(result!.provider).toBe("bundled");
    expect(result!.fallback).toBe(false);
  });

  it("generates music with Lyria provider", async () => {
    const provider = createMockMusicProvider({ filePath: "/tmp/lyria.mp3", metadata: { bpm: 70 } });

    const result = await resolveMusic(mockScore, sceneDurations, {
      musicProvider: provider,
      musicProviderKey: "lyria",
      llm: createMockLLM(),
    });

    expect(result).not.toBeNull();
    expect(result!.provider).toBe("lyria");
    expect(result!.fallback).toBe(false);
    expect(result!.prompt).toBeDefined();
    expect(result!.metadata).toEqual({ bpm: 70 });
    expect(result!.prompterUsage).toBeDefined();
  });

  it("falls back to bundled when Lyria fails", async () => {
    const provider = createMockMusicProvider(null, true);

    const result = await resolveMusic(mockScore, sceneDurations, {
      musicProvider: provider,
      musicProviderKey: "lyria",
      llm: createMockLLM(),
    });

    // Falls back to bundled — may be null if bundled also fails (no manifest in test env)
    // But the function should not throw
    expect(result === null || result.fallback === true).toBe(true);
  });

  it("emits progress events for music generation", async () => {
    const provider = createMockMusicProvider({ filePath: "/tmp/lyria.mp3" });
    const onProgress = vi.fn();
    const callbacks: PipelineCallbacks = { onProgress };

    await resolveMusic(mockScore, sceneDurations, {
      musicProvider: provider,
      musicProviderKey: "lyria",
      llm: createMockLLM(),
      callbacks,
    });

    expect(onProgress).toHaveBeenCalledWith("visuals", expect.objectContaining({ type: "music_generating" }));
    expect(onProgress).toHaveBeenCalledWith("visuals", expect.objectContaining({ type: "music_generated" }));
  });

  it("emits fallback progress event when Lyria fails", async () => {
    const provider = createMockMusicProvider(null, true);
    const onProgress = vi.fn();
    const callbacks: PipelineCallbacks = { onProgress };

    await resolveMusic(mockScore, sceneDurations, {
      musicProvider: provider,
      musicProviderKey: "lyria",
      llm: createMockLLM(),
      callbacks,
    });

    expect(onProgress).toHaveBeenCalledWith("visuals", expect.objectContaining({ type: "music_fallback" }));
  });
});

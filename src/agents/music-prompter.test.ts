import { describe, expect, it, vi } from "vitest";
import { generateMusicPrompt, type MusicPromptInput } from "./music-prompter.js";
import type { LLMProvider, LLMResult } from "../schema/providers.js";

function createMockLLM(response: { music_prompt: string }): LLMProvider {
  return {
    id: "anthropic",
    generate: vi.fn().mockResolvedValue({
      data: response,
      usage: { inputTokens: 100, outputTokens: 50 },
    } as LLMResult<typeof response>),
  };
}

const baseInput: MusicPromptInput = {
  musicMood: "epic_cinematic",
  emotionalArc: "curiosity-to-awe",
  archetype: "cinematic-documentary",
  archetypeMood: "Dramatic, sweeping, immersive",
  sceneDurations: [4.5, 6.2, 5.1, 4.8, 3.9],
  sceneNarratives: [
    "In the ancient temples of Kyoto, a tradition endures.",
    "For centuries, masters have passed down the art.",
    "But nothing could have prepared them for this moment.",
    "The revelation changed everything they believed.",
    "And so, a new chapter begins.",
  ],
  totalDurationSeconds: 30,
};

describe("generateMusicPrompt", () => {
  it("returns prompt from LLM", async () => {
    const mockLLM = createMockLLM({
      music_prompt: "Generate a 30-second cinematic orchestral piece...",
    });

    const result = await generateMusicPrompt(mockLLM, baseInput);

    expect(result.prompt).toContain("30-second cinematic orchestral");
    expect(result.usage.inputTokens).toBe(100);
  });

  it("includes scene timing and narratives in user message", async () => {
    const mockLLM = createMockLLM({ music_prompt: "test" });

    await generateMusicPrompt(mockLLM, baseInput);

    const call = vi.mocked(mockLLM.generate).mock.calls[0]![0];
    expect(call.userMessage).toContain("Scene 1:");
    expect(call.userMessage).toContain("Scene 5:");
    expect(call.userMessage).toContain("[0:00 -");
    expect(call.userMessage).toContain("epic_cinematic");
    expect(call.userMessage).toContain("curiosity-to-awe");
    // Narratives should be included for emotional context
    expect(call.userMessage).toContain("ancient temples of Kyoto");
    expect(call.userMessage).toContain("revelation changed everything");
  });

  it("never includes topic in user message", async () => {
    const mockLLM = createMockLLM({ music_prompt: "test" });

    await generateMusicPrompt(mockLLM, {
      ...baseInput,
      archetype: "anime-illustration",
    });

    const call = vi.mocked(mockLLM.generate).mock.calls[0]![0];
    // Should only contain musical fields, never topic/script content
    expect(call.userMessage).not.toContain("samurai");
    expect(call.userMessage).not.toContain("black hole");
    expect(call.userMessage).toContain("anime-illustration");
  });

  it("throws on empty prompt response", async () => {
    const mockLLM = createMockLLM({ music_prompt: "" });

    await expect(generateMusicPrompt(mockLLM, baseInput)).rejects.toThrow(
      "Music prompter returned empty prompt",
    );
  });

  it("formats timestamps correctly for >60s durations", async () => {
    const mockLLM = createMockLLM({ music_prompt: "test" });

    await generateMusicPrompt(mockLLM, {
      ...baseInput,
      sceneDurations: [30, 40, 20],
      sceneNarratives: ["intro", "middle", "end"],
      totalDurationSeconds: 95,
    });

    const call = vi.mocked(mockLLM.generate).mock.calls[0]![0];
    expect(call.userMessage).toContain("[1:10 -"); // 30 + 40 = 70s = 1:10
  });

  it("produces distinct prompts for different moods", async () => {
    const mockLLM = createMockLLM({ music_prompt: "test" });

    await generateMusicPrompt(mockLLM, { ...baseInput, musicMood: "tense_electronic" });
    const call1 = vi.mocked(mockLLM.generate).mock.calls[0]![0];

    vi.mocked(mockLLM.generate).mockClear();
    await generateMusicPrompt(mockLLM, { ...baseInput, musicMood: "chill_lofi" });
    const call2 = vi.mocked(mockLLM.generate).mock.calls[0]![0];

    expect(call1.userMessage).toContain("tense_electronic");
    expect(call2.userMessage).toContain("chill_lofi");
    expect(call1.userMessage).not.toBe(call2.userMessage);
  });
});

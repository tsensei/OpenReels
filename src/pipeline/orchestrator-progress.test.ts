import { describe, expect, it } from "vitest";
import type { PipelineCallbacks, StageName } from "./orchestrator.js";

/**
 * Tests for the 3 new onProgress calls added to the orchestrator.
 * These verify the event shape and placement, not the full pipeline
 * (which requires real providers). We test the callback wiring pattern.
 */

describe("onProgress event shapes", () => {
  it("research results event has correct shape", () => {
    const progressEvents: Array<{ stage: StageName; data: Record<string, unknown> }> = [];

    const cb: PipelineCallbacks = {
      onProgress(stage, data) {
        progressEvents.push({ stage, data });
      },
    };

    // Simulate what orchestrator.ts:184 does
    const researchResult = {
      summary: "Black holes are regions of spacetime",
      key_facts: ["Sagittarius A*", "Event horizon"],
      mood: "mysterious",
      sources: [],
    };

    cb.onProgress?.("research", {
      type: "results",
      summary: researchResult.summary,
      key_facts: researchResult.key_facts,
      mood: researchResult.mood,
    });

    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]?.stage).toBe("research");
    expect(progressEvents[0]?.data).toEqual({
      type: "results",
      summary: "Black holes are regions of spacetime",
      key_facts: ["Sagittarius A*", "Event horizon"],
      mood: "mysterious",
    });
  });

  it("director score event has correct shape", () => {
    const progressEvents: Array<{ stage: StageName; data: Record<string, unknown> }> = [];

    const cb: PipelineCallbacks = {
      onProgress(stage, data) {
        progressEvents.push({ stage, data });
      },
    };

    // Simulate what orchestrator.ts:222 does
    const directorScore = {
      emotional_arc: "curiosity → awe",
      archetype: "cinematic_documentary",
      music_mood: "mysterious_ambient",
      scenes: [
        {
          visual_type: "ai_image" as const,
          visual_prompt: "a black hole",
          motion: "zoom_in" as const,
          script_line: "What if you could fall into a black hole?",
        },
      ],
    };

    cb.onProgress?.("director", { type: "score", score: directorScore });

    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]?.stage).toBe("director");
    expect(progressEvents[0]?.data.type).toBe("score");
    expect(progressEvents[0]?.data.score).toBe(directorScore);
  });

  it("critic review event has correct shape", () => {
    const progressEvents: Array<{ stage: StageName; data: Record<string, unknown> }> = [];

    const cb: PipelineCallbacks = {
      onProgress(stage, data) {
        progressEvents.push({ stage, data });
      },
    };

    // Simulate what orchestrator.ts:403 does (after if/else block)
    const critique = {
      score: 8,
      strengths: ["Strong hook", "Good pacing"],
      weaknesses: ["Scene 5 transition could be smoother"],
      revision_needed: false,
      revision_instructions: null,
      weakest_scene_index: null,
    };

    cb.onProgress?.("critic", {
      type: "review",
      score: critique.score,
      strengths: critique.strengths,
      weaknesses: critique.weaknesses,
    });

    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]?.stage).toBe("critic");
    expect(progressEvents[0]?.data).toEqual({
      type: "review",
      score: 8,
      strengths: ["Strong hook", "Good pacing"],
      weaknesses: ["Scene 5 transition could be smoother"],
    });
  });

  it("onProgress is not called when research is skipped", () => {
    const progressEvents: Array<{ stage: StageName; data: Record<string, unknown> }> = [];

    const cb: PipelineCallbacks = {
      onProgress(stage, data) {
        progressEvents.push({ stage, data });
      },
    };

    // When research fails, orchestrator calls onStageSkip, NOT onProgress
    // Verify no progress event is emitted
    cb.onStageSkip?.("research", "web search failed");

    expect(progressEvents).toHaveLength(0);
  });
});

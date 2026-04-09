import { describe, expect, it } from "vitest";
import type { PipelineCallbacks } from "./orchestrator.js";
import { createCliCallbacks, STAGE_NAMES } from "./orchestrator.js";

describe("STAGE_NAMES", () => {
  it("contains all 6 stages in correct order", () => {
    expect(STAGE_NAMES).toEqual(["research", "director", "tts", "visuals", "assembly", "critic"]);
  });
});

describe("PipelineCallbacks interface", () => {
  it("accepts a minimal callbacks object with no methods", () => {
    const callbacks: PipelineCallbacks = {};
    expect(callbacks).toBeDefined();
  });

  it("accepts callbacks with all methods defined", () => {
    const events: string[] = [];
    const callbacks: PipelineCallbacks = {
      onStageStart(stage) {
        events.push(`start:${stage}`);
      },
      onStageComplete(stage, detail) {
        events.push(`complete:${stage}:${detail}`);
      },
      onStageSkip(stage, reason) {
        events.push(`skip:${stage}:${reason}`);
      },
      onStageError(stage, error) {
        events.push(`error:${stage}:${error}`);
      },
      onProgress(stage, _data) {
        events.push(`progress:${stage}`);
      },
      async onCostEstimate() {
        return true;
      },
      onActualCost() {},
      onLog(msg) {
        events.push(`log:${msg}`);
      },
      isCancelled() {
        return false;
      },
    };

    callbacks.onStageStart!("research");
    callbacks.onStageComplete!("director", "5 scenes", 2.3);
    callbacks.onStageSkip!("tts", "dry run");
    callbacks.onStageError!("visuals", "API error");
    callbacks.onLog!("test message");
    expect(callbacks.isCancelled!()).toBe(false);

    expect(events).toEqual([
      "start:research",
      "complete:director:5 scenes",
      "skip:tts:dry run",
      "error:visuals:API error",
      "log:test message",
    ]);
  });
});

describe("createCliCallbacks", () => {
  it("returns callbacks and progress objects", () => {
    const { callbacks, progress } = createCliCallbacks(true);
    expect(callbacks).toBeDefined();
    expect(progress).toBeDefined();
    expect(typeof callbacks.onStageStart).toBe("function");
    expect(typeof callbacks.onStageComplete).toBe("function");
    expect(typeof callbacks.onStageSkip).toBe("function");
  });

  it("auto-confirms cost estimate when yes=true", async () => {
    const { callbacks } = createCliCallbacks(true);
    const result = await callbacks.onCostEstimate!(
      {
        llmCost: 0,
        revisionCost: 0,
        ttsCost: 0,
        imageCost: 0,
        totalCost: 0.1,
        videoCost: 0,
        musicCost: 0,
        details: { llmCalls: 3, gateEvaluations: 0, revisionRounds: 0, ttsCharacters: 500, aiImages: 2, aiVideos: 0 },
      },
      "gemini",
    );
    expect(result).toBe(true);
  });
});

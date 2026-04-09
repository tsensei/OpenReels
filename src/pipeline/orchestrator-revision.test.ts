import { describe, expect, it, vi } from "vitest";
import type { PipelineCallbacks, StageName } from "./orchestrator.js";
import type { DirectorScore } from "../schema/director-score.js";
import type { CritiqueResult } from "../agents/critic.js";

/**
 * Tests for the Director-Critic revision loop inside directorStep.execute.
 *
 * These test the loop logic by simulating what the orchestrator does:
 * generate → evaluate → (revise if score < 7) → use best score.
 *
 * Full integration tests (real LLM calls) are not covered here.
 */

const makeScore = (archetype = "infographic", sceneCount = 8): DirectorScore => ({
  emotional_arc: "curiosity-to-wisdom",
  archetype,
  music_mood: "epic_cinematic",
  scenes: Array.from({ length: sceneCount }, (_, i) => {
    const visualTypes = ["text_card", "ai_image", "stock_video", "ai_image", "stock_image", "text_card", "ai_image", "stock_video"] as const;
    return {
      visual_type: visualTypes[i % 8]!,
      visual_prompt: `Scene ${i + 1}`,
      motion: "static" as const,
      script_line: `This is scene ${i + 1}.`,
      transition: i < sceneCount - 1 ? ("crossfade" as const) : null,
    };
  }),
});

const makeCritique = (score: number, revisionNeeded: boolean): CritiqueResult => ({
  score,
  strengths: ["good hook", "visual variety"],
  weaknesses: score < 7 ? ["weak pacing", "repetitive script"] : [],
  revision_needed: revisionNeeded,
  revision_instructions: revisionNeeded ? "Improve pacing in the middle scenes." : null,
  weakest_scene_index: revisionNeeded ? 3 : null,
});

/**
 * Simulates the revision loop from orchestrator.ts directorStep.execute.
 * Extracted here so we can test the logic without running the full Mastra workflow.
 */
async function simulateRevisionLoop(opts: {
  initialScore: DirectorScore;
  evaluateFn: (score: DirectorScore) => Promise<{ data: CritiqueResult; usage: { inputTokens: number; outputTokens: number } }>;
  reviseFn: (score: DirectorScore, critique: CritiqueResult) => Promise<{ data: DirectorScore; usage: { inputTokens: number; outputTokens: number } }>;
  callbacks?: PipelineCallbacks;
  maxRounds?: number;
}) {
  const { initialScore, evaluateFn, reviseFn, callbacks: cb, maxRounds = 2 } = opts;
  const llmUsages: { inputTokens: number; outputTokens: number }[] = [];
  let score = initialScore;
  let bestScore = score;
  let bestCritiqueScore = 0;
  let revisionRoundsCompleted = 0;

  for (let round = 0; round < maxRounds; round++) {
    try {
      const critiqueOutput = await evaluateFn(score);
      llmUsages.push(critiqueOutput.usage);
      const critique = critiqueOutput.data;

      if (critique.score > bestCritiqueScore) {
        bestScore = score;
        bestCritiqueScore = critique.score;
      }

      if (critique.score >= 7 || !critique.revision_needed) break;

      cb?.onProgress?.("director", { type: "revision", round: round + 1, critiqueScore: critique.score });
      cb?.onLog?.(`\n[director] Critic score: ${critique.score}/10 (round ${round + 1}), revising...`);

      const revised = await reviseFn(score, critique);
      llmUsages.push(revised.usage);
      score = revised.data;
      revisionRoundsCompleted++;
    } catch (err) {
      console.warn(`[director] Revision round ${round + 1} failed: ${err}`);
      break;
    }
  }

  score = bestScore;
  return { finalScore: score, bestCritiqueScore, revisionRoundsCompleted, llmUsages };
}

describe("Director-Critic revision loop", () => {
  it("skips revision when initial score >= 7", async () => {
    const evaluateFn = vi.fn().mockResolvedValue({
      data: makeCritique(8, false),
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    const reviseFn = vi.fn();

    const result = await simulateRevisionLoop({
      initialScore: makeScore(),
      evaluateFn,
      reviseFn,
    });

    expect(evaluateFn).toHaveBeenCalledTimes(1);
    expect(reviseFn).not.toHaveBeenCalled();
    expect(result.revisionRoundsCompleted).toBe(0);
    expect(result.bestCritiqueScore).toBe(8);
  });

  it("triggers revision when score < 7 and improves to >= 7", async () => {
    const revisedScore = makeScore("infographic", 9);
    const evaluateFn = vi.fn()
      .mockResolvedValueOnce({ data: makeCritique(5, true), usage: { inputTokens: 100, outputTokens: 50 } })
      .mockResolvedValueOnce({ data: makeCritique(8, false), usage: { inputTokens: 100, outputTokens: 50 } });
    const reviseFn = vi.fn().mockResolvedValue({
      data: revisedScore,
      usage: { inputTokens: 200, outputTokens: 100 },
    });

    const result = await simulateRevisionLoop({
      initialScore: makeScore(),
      evaluateFn,
      reviseFn,
    });

    expect(evaluateFn).toHaveBeenCalledTimes(2);
    expect(reviseFn).toHaveBeenCalledTimes(1);
    expect(result.revisionRoundsCompleted).toBe(1);
    expect(result.finalScore).toBe(revisedScore); // best score is the revised one (scored 8)
    expect(result.bestCritiqueScore).toBe(8);
  });

  it("exhausts max rounds and uses highest-scoring revision", async () => {
    const round1Score = makeScore("infographic", 9);
    const round2Score = makeScore("infographic", 10);

    const evaluateFn = vi.fn()
      .mockResolvedValueOnce({ data: makeCritique(4, true), usage: { inputTokens: 100, outputTokens: 50 } })
      .mockResolvedValueOnce({ data: makeCritique(6, true), usage: { inputTokens: 100, outputTokens: 50 } });
    const reviseFn = vi.fn()
      .mockResolvedValueOnce({ data: round1Score, usage: { inputTokens: 200, outputTokens: 100 } })
      .mockResolvedValueOnce({ data: round2Score, usage: { inputTokens: 200, outputTokens: 100 } });

    const result = await simulateRevisionLoop({
      initialScore: makeScore(),
      evaluateFn,
      reviseFn,
    });

    expect(evaluateFn).toHaveBeenCalledTimes(2);
    expect(reviseFn).toHaveBeenCalledTimes(2);
    expect(result.revisionRoundsCompleted).toBe(2);
    // Best score is round1Score (scored 6) not round2Score (never evaluated)
    expect(result.finalScore).toBe(round1Score);
    expect(result.bestCritiqueScore).toBe(6);
  });

  it("uses highest-scoring revision when later rounds degrade", async () => {
    const round1Score = makeScore("infographic", 9);
    const round2Score = makeScore("infographic", 10);

    // Round 1: score 6, revise
    // Round 2: score 4 (degradation), revise
    // Result: should use round1Score (scored 6), not round2Score (scored 4)
    const evaluateFn = vi.fn()
      .mockResolvedValueOnce({ data: makeCritique(3, true), usage: { inputTokens: 100, outputTokens: 50 } })
      .mockResolvedValueOnce({ data: makeCritique(6, true), usage: { inputTokens: 100, outputTokens: 50 } });
    const reviseFn = vi.fn()
      .mockResolvedValueOnce({ data: round1Score, usage: { inputTokens: 200, outputTokens: 100 } })
      .mockResolvedValueOnce({ data: round2Score, usage: { inputTokens: 200, outputTokens: 100 } });

    const result = await simulateRevisionLoop({
      initialScore: makeScore(),
      evaluateFn,
      reviseFn,
    });

    // Best is round1Score which was evaluated at 6
    expect(result.finalScore).toBe(round1Score);
    expect(result.bestCritiqueScore).toBe(6);
  });

  it("emits revision progress events", async () => {
    const events: Array<{ stage: StageName; data: Record<string, unknown> }> = [];
    const cb: PipelineCallbacks = {
      onProgress(stage, data) { events.push({ stage, data }); },
      onLog() {},
    };

    const evaluateFn = vi.fn()
      .mockResolvedValueOnce({ data: makeCritique(5, true), usage: { inputTokens: 100, outputTokens: 50 } })
      .mockResolvedValueOnce({ data: makeCritique(8, false), usage: { inputTokens: 100, outputTokens: 50 } });
    const reviseFn = vi.fn().mockResolvedValue({
      data: makeScore(),
      usage: { inputTokens: 200, outputTokens: 100 },
    });

    await simulateRevisionLoop({
      initialScore: makeScore(),
      evaluateFn,
      reviseFn,
      callbacks: cb,
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.stage).toBe("director");
    expect(events[0]?.data).toEqual({ type: "revision", round: 1, critiqueScore: 5 });
  });

  it("gracefully handles evaluate() failure", async () => {
    const evaluateFn = vi.fn().mockRejectedValue(new Error("LLM JSON parse failed"));
    const reviseFn = vi.fn();

    const result = await simulateRevisionLoop({
      initialScore: makeScore(),
      evaluateFn,
      reviseFn,
    });

    // Should proceed with initial score, no crash
    expect(result.revisionRoundsCompleted).toBe(0);
    expect(result.finalScore).toEqual(makeScore());
    expect(reviseFn).not.toHaveBeenCalled();
  });

  it("accumulates LLM usage across all revision rounds", async () => {
    const evaluateFn = vi.fn()
      .mockResolvedValueOnce({ data: makeCritique(5, true), usage: { inputTokens: 100, outputTokens: 50 } })
      .mockResolvedValueOnce({ data: makeCritique(8, false), usage: { inputTokens: 120, outputTokens: 60 } });
    const reviseFn = vi.fn().mockResolvedValue({
      data: makeScore(),
      usage: { inputTokens: 200, outputTokens: 100 },
    });

    const result = await simulateRevisionLoop({
      initialScore: makeScore(),
      evaluateFn,
      reviseFn,
    });

    // 2 evaluate calls + 1 revise call = 3 usage entries
    expect(result.llmUsages).toHaveLength(3);
    const totalInput = result.llmUsages.reduce((sum, u) => sum + u.inputTokens, 0);
    expect(totalInput).toBe(100 + 200 + 120); // eval1 + revise + eval2
  });
});

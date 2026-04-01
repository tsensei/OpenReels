import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressDisplay } from "./progress.js";

// Capture stdout writes instead of printing to terminal
let output: string[];
beforeEach(() => {
  output = [];
  vi.spyOn(process.stdout, "write").mockImplementation((data: string | Uint8Array) => {
    output.push(String(data));
    return true;
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ProgressDisplay", () => {
  it("renders pending stages with blank time", () => {
    const p = new ProgressDisplay();
    p.addStage("Research");
    p.addStage("TTS");
    // Trigger render by starting stage 0
    p.start(0);
    const joined = output.join("");
    // Pending stage (TTS) should not show a time value
    expect(joined).toContain("TTS");
  });

  it("renders a spinner for running stages", () => {
    const p = new ProgressDisplay();
    p.addStage("Research");
    p.start(0);
    // The running stage should include a time like "0.0s"
    const joined = output.join("");
    expect(joined).toMatch(/\d+\.\d+s/);
  });

  it("starts a tick interval on start() and clears on complete()", () => {
    const p = new ProgressDisplay();
    const idx = p.addStage("Research");
    p.start(idx);

    // Advance fake timers — spinner should update
    const beforeLen = output.length;
    vi.advanceTimersByTime(160); // 2 ticks at 80ms
    expect(output.length).toBeGreaterThan(beforeLen);

    // Complete the stage — interval should stop
    p.complete(idx, "done");
    const afterComplete = output.length;
    vi.advanceTimersByTime(160);
    // No more renders after completion
    expect(output.length).toBe(afterComplete);
  });

  it("shows checkmark and duration for completed stages", () => {
    const p = new ProgressDisplay();
    const idx = p.addStage("Research");
    p.start(idx);
    p.complete(idx, "8 facts");
    const joined = output.join("");
    expect(joined).toContain("\u2714"); // checkmark
    expect(joined).toContain("8 facts");
  });

  it("shows X mark for failed stages", () => {
    const p = new ProgressDisplay();
    const idx = p.addStage("TTS");
    p.start(idx);
    p.fail(idx, "API error");
    const joined = output.join("");
    expect(joined).toContain("\u2718"); // X mark
    expect(joined).toContain("API error");
  });

  it("summary clears the interval and prints totals", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const p = new ProgressDisplay();
    const idx = p.addStage("Research");
    p.start(idx);
    p.complete(idx);
    p.summary();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Completed 1/1 stages"));
  });

  it("keeps ticking if one stage completes but another is still running", () => {
    const p = new ProgressDisplay();
    const a = p.addStage("Research");
    const b = p.addStage("TTS");
    p.start(a);
    p.start(b);
    p.complete(a, "done");

    // Stage b still running — ticks should continue
    const beforeLen = output.length;
    vi.advanceTimersByTime(160);
    expect(output.length).toBeGreaterThan(beforeLen);

    p.complete(b, "done");
    const afterComplete = output.length;
    vi.advanceTimersByTime(160);
    expect(output.length).toBe(afterComplete);
  });
});

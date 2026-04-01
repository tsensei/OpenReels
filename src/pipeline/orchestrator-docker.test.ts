import { describe, expect, it } from "vitest";
import { shouldAutoConfirm, shouldSkipPreview } from "./orchestrator.js";

describe("non-interactive mode", () => {
  it("auto-confirms when yes is true", () => {
    expect(shouldAutoConfirm(true)).toBe(true);
  });

  it("auto-confirms when stdin is not a TTY", () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });

    expect(shouldAutoConfirm(false)).toBe(true);

    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
  });

  it("does not auto-confirm when yes=false and stdin is TTY", () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

    expect(shouldAutoConfirm(false)).toBe(false);

    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
  });

  it("skips preview in non-TTY environment", () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });

    expect(shouldSkipPreview()).toBe(true);

    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
  });

  it("does not skip preview in TTY environment", () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

    expect(shouldSkipPreview()).toBe(false);

    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
  });
});

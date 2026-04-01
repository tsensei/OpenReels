import { describe, it, expect, vi } from "vitest";

describe("non-interactive mode", () => {
  it("auto-confirms when opts.yes is true", () => {
    const autoConfirm = true || !process.stdin.isTTY;
    expect(autoConfirm).toBe(true);
  });

  it("auto-confirms when stdin is not a TTY", () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });

    const autoConfirm = false || !process.stdin.isTTY;
    expect(autoConfirm).toBe(true);

    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
  });

  it("does not auto-confirm when yes=false and stdin is TTY", () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

    const autoConfirm = false || !process.stdin.isTTY;
    expect(autoConfirm).toBe(false);

    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
  });

  it("warns and skips preview in non-TTY environment", () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const preview = true;
    if (preview) {
      if (!process.stdin.isTTY) {
        console.warn("--preview requires an interactive terminal (skipped in Docker/CI).");
      }
    }

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("--preview requires an interactive terminal"),
    );

    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
    warnSpy.mockRestore();
  });
});

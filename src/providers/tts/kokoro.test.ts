import { describe, expect, it, vi, beforeEach } from "vitest";
import { KokoroTTS } from "./kokoro.js";

// Mock child_process.execFile
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// Mock fs/promises — keep mkdtemp and rm real-ish, mock readFile and writeFile
vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn().mockResolvedValue("/tmp/kokoro-test"),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from("RIFF....WAVEfmt fake audio")),
  rm: vi.fn().mockResolvedValue(undefined),
}));

describe("KokoroTTS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns audio buffer with empty words array", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) => cb(null, "", ""),
    );

    const tts = new KokoroTTS();
    const result = await tts.generate("Hello world");

    expect(Buffer.isBuffer(result.audio)).toBe(true);
    expect(result.words).toEqual([]);
  });

  it("writes config JSON with correct voice and text", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) => cb(null, "", ""),
    );

    const tts = new KokoroTTS("bf_emma");
    await tts.generate("Hello world");

    const { writeFile } = await import("node:fs/promises");
    expect(writeFile).toHaveBeenCalled();
    const call = vi.mocked(writeFile).mock.calls[0]!;
    const config = JSON.parse(call[1] as string);
    expect(config.voice).toBe("bf_emma");
    expect(config.text).toBe("Hello world");
  });

  it("uses default voice af_heart", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) => cb(null, "", ""),
    );

    const tts = new KokoroTTS();
    await tts.generate("Hello");

    const { writeFile } = await import("node:fs/promises");
    const call = vi.mocked(writeFile).mock.calls[0]!;
    const config = JSON.parse(call[1] as string);
    expect(config.voice).toBe("af_heart");
  });

  it("wraps subprocess errors with descriptive message", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) =>
        cb(new Error("spawn npx ENOENT"), "", "Command not found"),
    );

    const tts = new KokoroTTS();
    await expect(tts.generate("Hello")).rejects.toThrow("Kokoro TTS failed");
  });

  it("includes stderr in error message", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) =>
        cb(new Error("exit code 1"), "", "ONNX runtime error: SIGABRT"),
    );

    const tts = new KokoroTTS();
    await expect(tts.generate("Hello")).rejects.toThrow("ONNX runtime error: SIGABRT");
  });

  it("passes text safely through JSON config (special characters)", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) => cb(null, "", ""),
    );

    const tts = new KokoroTTS();
    const specialText = 'He said "hello" & she said \'goodbye\'\nnew line';
    await tts.generate(specialText);

    const { writeFile } = await import("node:fs/promises");
    const call = vi.mocked(writeFile).mock.calls[0]!;
    const config = JSON.parse(call[1] as string);
    expect(config.text).toBe(specialText);
  });

  it("cleans up temp directory after success", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) => cb(null, "", ""),
    );

    const tts = new KokoroTTS();
    await tts.generate("Hello");

    const { rm } = await import("node:fs/promises");
    expect(rm).toHaveBeenCalledWith("/tmp/kokoro-test", { recursive: true, force: true });
  });

  it("cleans up temp directory after error", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) =>
        cb(new Error("failed"), "", ""),
    );

    const tts = new KokoroTTS();
    await expect(tts.generate("Hello")).rejects.toThrow();

    const { rm } = await import("node:fs/promises");
    expect(rm).toHaveBeenCalled();
  });
});

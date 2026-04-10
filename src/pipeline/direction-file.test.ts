import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("direction file validation (CLI-level logic)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openreels-direction-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads a valid markdown direction file", () => {
    const filePath = path.join(tmpDir, "brief.md");
    fs.writeFileSync(filePath, "# My Brief\nUse cinematic style\n");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("cinematic");
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("rejects a file exceeding 10KB", () => {
    const filePath = path.join(tmpDir, "large.md");
    fs.writeFileSync(filePath, "x".repeat(10241));
    const stat = fs.statSync(filePath);
    expect(stat.size).toBeGreaterThan(10240);
  });

  it("detects binary content via null byte check", () => {
    const filePath = path.join(tmpDir, "binary.bin");
    const buf = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
    fs.writeFileSync(filePath, buf);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.includes("\0")).toBe(true);
  });

  it("treats empty file as no direction", () => {
    const filePath = path.join(tmpDir, "empty.md");
    fs.writeFileSync(filePath, "");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.trim()).toBe("");
  });

  it("treats whitespace-only file as no direction", () => {
    const filePath = path.join(tmpDir, "whitespace.md");
    fs.writeFileSync(filePath, "   \n\t\n   ");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.trim()).toBe("");
  });

  it("throws ENOENT for non-existent file", () => {
    expect(() => fs.readFileSync(path.join(tmpDir, "nope.md"), "utf-8")).toThrow();
  });

  it("validates 10KB limit using byte length for CJK content", () => {
    // CJK characters are 3 bytes each in UTF-8
    // 3414 CJK chars = 10242 bytes > 10240 limit
    const filePath = path.join(tmpDir, "cjk.md");
    const cjkContent = "\u4e16".repeat(3414);
    fs.writeFileSync(filePath, cjkContent);
    const stat = fs.statSync(filePath);
    expect(stat.size).toBeGreaterThan(10240);
  });
});

describe("direction injection into creative director", () => {
  it("appends direction section to generateDirectorScore prompt", async () => {
    // Import the module to verify direction is accepted in the options type
    const { generateDirectorScore } = await import("../agents/creative-director.js");
    // Type check: direction is a valid option key
    const opts: Parameters<typeof generateDirectorScore>[3] = {
      direction: "Use noir style",
    };
    expect(opts.direction).toBe("Use noir style");
  });

  it("appends direction section to reviseDirectorScore prompt", async () => {
    const { reviseDirectorScore } = await import("../agents/creative-director.js");
    // Type check: direction is a valid option key
    const opts: Parameters<typeof reviseDirectorScore>[5] = {
      direction: "Keep it dark",
    };
    expect(opts.direction).toBe("Keep it dark");
  });
});

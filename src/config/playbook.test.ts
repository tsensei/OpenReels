import { describe, expect, it } from "vitest";
import { loadPlaybookSections, parseSections } from "./playbook.js";

describe("parseSections", () => {
  it("parses multiple ## sections correctly", () => {
    const content = `# Title

## Section One

Content of section one.

## Section Two

Content of section two.
More content here.
`;
    const sections = parseSections(content);
    expect(Object.keys(sections)).toEqual(["Section One", "Section Two"]);
    expect(sections["Section One"]).toContain("Content of section one.");
    expect(sections["Section Two"]).toContain("Content of section two.");
    expect(sections["Section Two"]).toContain("More content here.");
  });

  it("keeps ### sub-headers within parent ## section", () => {
    const content = `## Parent Section

Intro text.

### Sub Section A

Sub content A.

### Sub Section B

Sub content B.

## Next Section

Next content.
`;
    const sections = parseSections(content);
    expect(Object.keys(sections)).toEqual(["Parent Section", "Next Section"]);
    expect(sections["Parent Section"]).toContain("### Sub Section A");
    expect(sections["Parent Section"]).toContain("Sub content A.");
    expect(sections["Parent Section"]).toContain("### Sub Section B");
    expect(sections["Parent Section"]).toContain("Sub content B.");
  });

  it("returns empty map for empty content", () => {
    expect(parseSections("")).toEqual({});
  });

  it("returns empty map for content without ## headers", () => {
    expect(parseSections("# Title\n\nSome text without ## headers.")).toEqual({});
  });

  it("handles a single section", () => {
    const content = `## Only Section

Only content.
`;
    const sections = parseSections(content);
    expect(Object.keys(sections)).toEqual(["Only Section"]);
    expect(sections["Only Section"]).toContain("Only content.");
  });
});

describe("loadPlaybookSections", () => {
  it("extracts requested sections from the playbook", () => {
    const result = loadPlaybookSections(["Critic Rubric"]);
    expect(result).toContain("## Critic Rubric");
    expect(result).toContain("Hook Strength");
    expect(result).toContain("Scoring Formula");
  });

  it("throws on missing section with available sections list", () => {
    expect(() => loadPlaybookSections(["Nonexistent Section"])).toThrowError(/not found/);
    expect(() => loadPlaybookSections(["Nonexistent Section"])).toThrowError(/Available/);
  });
});

import * as fs from "node:fs";
import * as path from "node:path";

const PLAYBOOK_PATH = path.join(process.cwd(), "prompts", "playbook.md");

/**
 * Load the full playbook content.
 */
export function loadPlaybook(): string {
  try {
    return fs.readFileSync(PLAYBOOK_PATH, "utf-8");
  } catch {
    throw new Error(`Playbook not found at ${PLAYBOOK_PATH}. Ensure prompts/playbook.md exists.`);
  }
}

/**
 * Extract specific ## sections from the playbook by header name.
 * Returns the concatenated content of all requested sections.
 */
export function loadPlaybookSections(names: string[]): string {
  const content = loadPlaybook();
  const sections = parseSections(content);

  if (Object.keys(sections).length === 0) {
    throw new Error("Playbook has no ## sections.");
  }

  const parts: string[] = [];
  for (const name of names) {
    const section = sections[name];
    if (!section) {
      const available = Object.keys(sections).join(", ");
      throw new Error(`Playbook section '${name}' not found. Available: ${available}`);
    }
    parts.push(section);
  }

  return parts.join("\n\n");
}

/**
 * Parse playbook content into a map of section name to section content.
 * Splits on `## ` headers. Sub-headers (###) stay within the parent section.
 */
export function parseSections(content: string): Record<string, string> {
  const pattern = /^## (.+)$/gm;
  const matches = [...content.matchAll(pattern)];
  const sections: Record<string, string> = {};

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const name = match[1]!.trim();
    const start = match.index!;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : content.length;
    sections[name] = content.slice(start, end).trim();
  }

  return sections;
}

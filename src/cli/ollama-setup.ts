/**
 * Ollama local provider setup: reachability check and interactive model selection.
 */

import * as readline from "node:readline";

/**
 * Curated LLM models known to reliably produce structured JSON output.
 * Only 7B+ parameter models are included — smaller models consistently fail
 * at the constrained JSON generation this pipeline requires.
 * Each entry is the exact tag Ollama expects (name:params).
 */
export const KNOWN_LLM_MODELS = [
  "llama3.1:8b",
  "llama3.2:latest",    // 3b — borderline but usable
  "llama3.3:70b",
  "mistral:7b",
  "mixtral:8x7b",
  "gemma3:9b",
  "gemma3:27b",
  "qwen2.5:7b",
  "qwen2.5:14b",
  "phi4:14b",
  "deepseek-r1:7b",
  "deepseek-r1:14b",
];

/**
 * The only models that support image generation in Ollama (macOS, experimental).
 * https://ollama.com/blog/image-generation
 * Full tags are required — Ollama returns 404 for bare names like "x/flux2-klein".
 */
export const KNOWN_IMAGE_MODELS = [
  "x/flux2-klein:4b",
  "x/flux2-klein:9b",
  "x/z-image-turbo:latest",
];

interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}

/** Checks Ollama is reachable and returns the list of locally pulled model names. */
export async function checkOllamaReachable(host: string): Promise<string[]> {
  const url = `${host.replace(/\/$/, "")}/api/tags`;
  let data: OllamaTagsResponse;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = (await res.json()) as OllamaTagsResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `\n✗ Ollama is not reachable at ${host}\n` +
      `  Error: ${msg}\n\n` +
      `  → Start Ollama:   ollama serve\n` +
      `  → Install Ollama: https://ollama.com\n` +
      `  → Or override host with: --ollama-host <url>\n`,
    );
    process.exit(1);
  }

  return (data.models ?? []).map((m) => m.name);
}

/**
 * Shows a numbered list of model choices and lets the user pick one.
 *
 * For each known model, if the user already has it pulled locally we show the
 * exact pulled name (e.g. "gemma3:27b") so Ollama receives the right tag.
 * Unpulled known models are shown with their recommended tag from KNOWN_*_MODELS.
 *
 * For image models the list is locked to KNOWN_IMAGE_MODELS only — other locally
 * pulled models are never shown because they cannot generate images.
 *
 * @param lockToKnown  When true, only show knownModels (no "other pulled" bucket).
 */
export async function selectOllamaModel(
  pulledModels: string[],
  knownModels: string[],
  label: string,
  lockToKnown = false,
): Promise<string> {
  // Build a lookup: base name → full pulled tag (e.g. "gemma3" → "gemma3:27b")
  // When the user has multiple tags of the same base, prefer non-"latest" tags (more specific).
  const pulledByBase = new Map<string, string>();
  for (const fullTag of pulledModels) {
    const base = fullTag.replace(/:.*$/, "");
    const existing = pulledByBase.get(base);
    if (!existing || existing === `${base}:latest`) {
      pulledByBase.set(base, fullTag);
    }
  }

  const resolveDisplayName = (knownEntry: string): string => {
    const base = knownEntry.replace(/:.*$/, "");
    return pulledByBase.get(base) ?? knownEntry;
  };

  const isPulled = (knownEntry: string): boolean =>
    pulledByBase.has(knownEntry.replace(/:.*$/, ""));

  const pulledKnown = knownModels.filter(isPulled);
  const unpulledKnown = knownModels.filter((m) => !isPulled(m));

  // LLM selector surfaces other pulled models too; image selector is locked to known list.
  const otherPulled = lockToKnown
    ? []
    : pulledModels.filter((fullTag) => {
        const base = fullTag.replace(/:.*$/, "");
        return !knownModels.some((k) => k.replace(/:.*$/, "") === base);
      });

  const options: Array<{ display: string; pulled: boolean }> = [
    ...pulledKnown.map((m) => ({ display: resolveDisplayName(m), pulled: true })),
    ...otherPulled.map((m) => ({ display: m, pulled: true })),
    ...unpulledKnown.map((m) => ({ display: m, pulled: false })),
  ];

  console.info(`\n─────────────────────────────────────────────────────────────`);
  console.info(` Select an Ollama model for ${label}:`);
  console.info(` (✓ = already pulled locally; others require: ollama pull <name>)\n`);

  options.forEach(({ display, pulled }, i) => {
    console.info(`  [${i + 1}] ${pulled ? "✓" : " "} ${display}`);
  });
  console.info(`  [${options.length + 1}]   Enter a custom model name`);
  console.info(`─────────────────────────────────────────────────────────────\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

  let chosen = "";
  while (!chosen) {
    const raw = await ask(`Your choice (1–${options.length + 1}): `);
    const n = parseInt(raw, 10);

    if (n >= 1 && n <= options.length) {
      chosen = options[n - 1]?.display ?? "";
    } else if (n === options.length + 1 || (!Number.isInteger(n) && raw.length > 0)) {
      const manual = Number.isInteger(n) ? await ask(`Model name (e.g. llama3.1:8b): `) : raw;
      if (manual.length > 0) chosen = manual;
    } else {
      console.info(`  Please enter a number between 1 and ${options.length + 1}.`);
    }
  }

  rl.close();
  console.info(`\n  Using model: ${chosen}\n`);
  return chosen;
}

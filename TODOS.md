# TODOS

## Pipeline Robustness

- [ ] **Lazy provider initialization** — Defer TTS/image/stock provider construction until needed so --dry-run works without all API keys set
  **Priority:** P1

- [ ] **API call timeouts** — Add AbortSignal.timeout() to all fetch calls and SDK client timeouts to prevent hung requests blocking the pipeline indefinitely
  **Priority:** P1

- [ ] **Resolve prompts relative to package** — Use import.meta.url instead of process.cwd() for prompt file paths so the CLI works when installed globally or run from outside project root
  **Priority:** P1

- [ ] **Validate --provider and --archetype early** — Use Commander.choices() for --provider and validate --archetype against registry at CLI parse time, before spending API calls
  **Priority:** P2

- [ ] **ElevenLabs response validation** — Add runtime checks on TTS response shape before accessing audio_base64 and alignment fields
  **Priority:** P2

- [ ] **Stock cache eviction** — Add max-size or max-age eviction for ~/.openreels/cache/stock/ to prevent unbounded disk growth
  **Priority:** P3

- [ ] **Atomic cache downloads** — Write to temp file then rename to prevent corrupt partial files from race conditions or network drops
  **Priority:** P3

## Completed

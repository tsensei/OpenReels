# TODOS

## Pipeline Robustness

- [ ] **Lazy provider initialization** — Defer TTS/image/stock provider construction until needed so --dry-run works without all API keys set
  **Priority:** P1

- [ ] **API call timeouts** — Add AbortSignal.timeout() to all fetch calls and SDK client timeouts to prevent hung requests blocking the pipeline indefinitely
  **Priority:** P1

- [ ] **Resolve prompts relative to package** — Use import.meta.url instead of process.cwd() for prompt file paths so the CLI works when installed globally or run from outside project root. Not blocking Docker (tsx + WORKDIR /app handles it), but still needed for npm distribution.
  **Priority:** P2

- [ ] **Validate --provider and --archetype early** — Use Commander.choices() for --provider and validate --archetype against registry at CLI parse time, before spending API calls
  **Priority:** P2

- [ ] **ElevenLabs response validation** — Add runtime checks on TTS response shape before accessing audio_base64 and alignment fields
  **Priority:** P2

- [ ] **Stock cache eviction** — Add max-size or max-age eviction for ~/.openreels/cache/stock/ to prevent unbounded disk growth
  **Priority:** P3

- [ ] **Atomic cache downloads** — Write to temp file then rename to prevent corrupt partial files from race conditions or network drops
  **Priority:** P3

## Transitions

- [ ] **Per-transition-type duration mapping** — Add per-type duration overrides to archetypes (e.g., `transitionDurations: { crossfade: 15, flip: 20, wipe: 12 }`). Different transition types need different durations to look natural. Current single-value approach works but flip at 12 frames looks rushed while crossfade at 12 frames is fine.
  **Priority:** P3
  **Depends on:** v0.2.0 shipping first

- [ ] **Verify beat component frame behavior under TransitionSeries** — Confirm that AIImageBeat/StockVideoBeat/TextCardBeat motion calculations (zoom, pan, spring) produce identical results inside TransitionSeries.Sequence vs regular Sequence. If frame context differs, motion animations would be stretched or compressed.
  **Priority:** P2

## Docker

- [ ] **Remotion pre-bundling optimization** — Pre-bundle Remotion compositions during `docker build` to cache webpack output and Google Fonts in the image layer. Each render currently pays ~30-60s for webpack bundling. Needs validation that `staticFile()` references don't fail with missing assets at build time.
  **Priority:** P3

- [ ] **HTTP API server mode** — Add a Fastify HTTP server (`openreels serve`) with POST /render, GET /render/:id/status, GET /render/:id/download, SSE /render/:id/events. Foundation for web UI and programmatic access.
  **Priority:** P2
  **Depends on:** Docker containerization shipping first

## Completed

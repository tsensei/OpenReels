# TODOS

## Pipeline Robustness

- [x] **Lazy provider initialization** — Defer TTS/image/stock provider construction until needed so --dry-run works without all API keys set
  **Priority:** P1
  **Completed:** v0.6.0 (2026-04-03) — Mastra workflow steps create providers when they execute; dry-run exits after director step before TTS/image providers are needed.

- [ ] **API call timeouts** — Wire AbortSignal.timeout() through AI SDK 6 generateText() calls, TTS/image fetch calls, and VideoProvider.generate() calls to prevent hung requests. AI SDK 6 supports abortSignal natively but it's not yet passed through the LLMProvider interface or workflow steps. Video gen is the longest-running call (60-120s per scene) and most likely to benefit.
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

- [ ] **Verify beat component frame behavior under TransitionSeries** — Confirm that AIImageBeat/StockVideoBeat/TextCardBeat motion calculations (zoom, pan, spring) produce identical results inside TransitionSeries.Sequence vs regular Sequence. If frame context differs, motion animations would be stretched or compressed.
  **Priority:** P2

## Docker

- [ ] **Remotion pre-bundling optimization** — Pre-bundle Remotion compositions during `docker build` to cache webpack output and Google Fonts in the image layer. Each render currently pays ~30-60s for webpack bundling. Needs validation that `staticFile()` references don't fail with missing assets at build time.
  **Priority:** P3

## Web UI

- [ ] **API key validation endpoint** — Add POST /api/v1/config/validate-keys that makes lightweight test calls to each provider to verify keys are valid before starting a job.
  **Priority:** P2
  Deferred from plan: tsensei-main-design-20260401-202558.md

- [ ] **SSE Last-Event-ID reconnection** — Support Last-Event-ID header on SSE reconnection to replay missed events. Currently clients get a fresh snapshot on reconnect but may miss intermediate stage events.
  **Priority:** P2
  Deferred from plan: tsensei-main-design-20260401-202558.md

- [ ] **Gallery thumbnails** — Extract a frame at 1-second mark from rendered videos using FFmpeg for gallery card thumbnails. Fall back to first generated image from stage-visuals/.
  **Priority:** P2
  Deferred from plan: tsensei-main-design-20260401-202558.md

- [ ] **API key headers** — Support per-provider API keys via request headers (X-OpenReels-Key-Anthropic, etc.) as alternative to request body keys field.
  **Priority:** P3
  Deferred from plan: tsensei-main-design-20260401-202558.md

- [ ] **Retry from failed stage** — Add POST /api/v1/jobs/:id/retry endpoint and pipeline resume capability. Requires: orchestrator accepts "start from stage" parameter, worker loads prior stage artifacts from disk, new API endpoint creates a re-run job. UI shows retry button in failed state.
  **Priority:** P2
  Deferred from plan: Pipeline Page UI/UX Redesign (eng review: no backend support exists)

- [ ] **Per-scene visual progress events** — Emit onProgress per scene success during visuals stage (currently only emits asset_failed). Enables running panel to show "3/7 assets done" progress bar during the longest pipeline wait.
  **Priority:** P3
  Deferred from plan: Pipeline Page UI/UX Redesign (eng review: nice-to-have, not blocking)

- [ ] **Integration test suite** — Add Docker-based integration tests for server.ts and worker.ts using testcontainers or docker-compose test profile with Redis.
  **Priority:** P2

## Music

- [ ] **Crossfade at loop point** — Add ~2s crossfade overlap in MusicTrack.tsx when a video is longer than the track. Requires layering two Audio elements with offset start times and blending volumes during overlap. Most Shorts (30-60s) with 90s tracks never loop, so this is low priority.
  **Priority:** P3
  Deferred from plan: Background Music Library (CEO review: underspecified, risky, rarely fires)

- [ ] **Archetype-aware music mood preferences** — Add `musicMoodPreference: MusicMood[]` to each archetype config for a three-tier selection cascade. Currently using two-tier (enum + random fallback). Revisit if LLM mood mismatches become a problem in practice.
  **Priority:** P3
  Deferred from plan: Background Music Library (CEO review: simplified per outside voice)

## Stock Verification

- [ ] **Global scene quality pass** — After all assets resolve, score each scene's visual quality and re-try weak ones with reallocated budget (stock savings → more AI attempts on hard scenes). Scene-level optimization where the pipeline currently optimizes each scene independently.
  **Priority:** P3
  **Depends on:** Adaptive stock pipeline (v0.7.0)
  Deferred from plan: Vision-Verified Adaptive Stock Pipeline (CEO review: correctly scoped as post-verification feature)

## Video Generation

- [ ] **Mid-pipeline cancellation for video gen** — Check isCancelled() before starting Phase 2 (video gen) for each scene in resolveAIVideo(). Currently isCancelled() is checked between stages but not between individual scenes within Promise.all(). Video gen takes 60-120s per scene; without this, up to 3 concurrent scenes continue generating (and spending $0.25-0.35 each) after cancellation.
  **Priority:** P2
  **Depends on:** AI video generation feature
  Deferred from plan: AI Video Generation (CEO review: outside voice flagged, user deferred to TODO)

## Completed

- [x] **HTTP API server mode** — Fastify HTTP server with POST /api/v1/jobs, GET /api/v1/jobs/:id, SSE /api/v1/jobs/:id/events, plus full React web UI.
  **Completed:** v0.4.0 (2026-04-02)

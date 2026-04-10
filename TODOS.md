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

## Provider Gateway

- [ ] **Model capability detection for openai-compatible** — Probe openai-compatible providers for structured output + tool calling support. Gracefully degrade unsupported features with clear error messages instead of opaque SDK errors. Llama 3 8B via Ollama can't do schema-constrained output; user should see "this model doesn't support structured output" not a stack trace.
  **Priority:** P2
  **Depends on:** Universal provider gateway (v0.16.0)

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

- [ ] **Gemini generateVideos initial call timeout** — The 180s `TIMEOUT_MS` in gemini.ts only guards the polling loop. The initial `this.client.models.generateVideos()` call that submits the job has no application-level timeout, relying on OS socket timeout (~120s). Wrap with `Promise.race` or `AbortSignal.timeout()`. Same class of issue as the fal.ai subscribe timeout (P1 in Pipeline Robustness).
  **Priority:** P2

- [ ] **Expand Motion enum with cinematic camera directions** — Current Motion enum is `zoom_in | zoom_out | pan_right | pan_left | static`. For `ai_video` scenes, the creative director could specify richer camera directions (`dolly_in`, `tracking`, `crane_up`, `orbit`) that feed into the video-prompter. Touches schema (breaking change), creative-director prompt, Remotion score-to-props mapper. Phase 2 after video quality enhancement ships and we evaluate improvement.
  **Priority:** P2
  **Depends on:** Video generation quality enhancement
  Deferred from plan: Video Generation Quality Enhancement (CEO review: accepted as follow-up)

- [ ] **Video generation safety re-prompting** — Unlike image generation (which retries with a sanitized prompt on safety rejection), video generation falls back to static image immediately. The motion prompt could be sanitized the same way. Also, `isSafetyRejection()` in orchestrator.ts:204 doesn't check for `"forbidden"` which is what Veo returns for RAI-filtered content.
  **Priority:** P2

## TTS

- [ ] **Voice catalog command** — Add `--list-voices <provider>` CLI flag that prints available voices for any TTS provider (ElevenLabs, Inworld, Kokoro, Gemini TTS, OpenAI TTS) and exits. Users currently have no way to discover voice options without reading provider docs. Kokoro has ~50 voices, Gemini TTS has multiple, ElevenLabs has hundreds. Build as a unified interface across all providers rather than provider-specific flags.
  **Priority:** P3
  **Depends on:** TTS alignment layer (Kokoro + Gemini TTS providers)
  Deferred from plan: Unified TTS Alignment Layer (CEO review: user prefers unified voice interface later)

## Critic / Quality Gate

- [ ] **Deterministic structural validation for DirectorScore** — Extract pacing checks (total word count, scene count, per-scene word bounds, consecutive visual_type runs) into a TypeScript validation function. Run it after DirectorScore.parse() in the existing retry loop. Structural violations become retry errors (fed back as error context to the director), not LLM critic concerns. Saves 1-2 LLM calls when the issue is structural, and makes structural quality a guaranteed invariant rather than probabilistic.
  **Priority:** P3
  **Depends on:** Director-Critic quality gate (v0.15.0)
  Deferred from plan: Director-Critic Quality Gate (eng review: outside voice recommended splitting deterministic vs subjective evaluation)

## Captions

- [ ] **Contextual emphasis on power words** — Creative director marks 1-3 power words per scene with asterisks in script_line. Pipeline strips markers before TTS and records emphasisIndices. CaptionWrapper applies extra animation treatment (larger font-size delta, accent color flash) to emphasis words. Requires: (a) strip asterisks before ALL downstream consumers (critic, image prompter, TTS), not just TTS, (b) creative director prompt update with emphasis marking instructions, (c) emphasisIndices field on CompositionProps (optional, backward compat), (d) CaptionWrapper emphasis detection logic. Per-word asterisks format: `*New* *York*` not `*New York*`.
  **Priority:** P2
  **Depends on:** Caption system upgrade v2 (CaptionWrapper + animated styles)
  Deferred from plan: Caption System Upgrade v2 (CEO review: outside voice flagged cross-layer complexity across prompt+pipeline+schema+render. Ship base upgrade first.)

## Documentation

- [ ] **Interactive @remotion/player embeds in docs** — Add `@remotion/player` to archetype gallery pages so visitors can see DirectorScore fixtures render in-browser without installing anything. The compositions (`OpenReelsVideo.tsx`) and score-to-props mapper (`src/remotion/lib/`) already exist but are wired for server-side rendering. Porting to client-side player requires: bundle the Remotion player (~500KB), adapt score-to-props for browser context, verify static export compatibility, handle missing assets gracefully. Remotion's own docs site already does this pattern, proving feasibility.
  **Priority:** P3
  **Depends on:** v1 docs site deployed and working
  Deferred from plan: Fumadocs Documentation Site (design doc Approach B, deferred for bundle size and porting risk)

## Completed

- [x] **HTTP API server mode** — Fastify HTTP server with POST /api/v1/jobs, GET /api/v1/jobs/:id, SSE /api/v1/jobs/:id/events, plus full React web UI.
  **Completed:** v0.4.0 (2026-04-02)

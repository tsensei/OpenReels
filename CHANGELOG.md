# Changelog

All notable changes to OpenReels will be documented in this file.

## [0.8.0] - 2026-04-04

### Added
- AI video generation. Scenes marked `ai_video` get a first-frame AI image, then animate it into a 4-10 second video clip via Google Veo or fal.ai (Kling). Motion is the story... explosions, flowing water, rocket launches come alive.
- Two video providers: Google Veo (`--video-provider gemini`) and fal.ai Kling (`--video-provider fal`). Cross-provider fallback tries the secondary provider on failure, then degrades gracefully to a static AI image.
- LLM-generated motion prompts. When generating video, a separate prompt optimization pass produces motion-rich descriptions ("asteroid rotates against star field, debris trail, Earth grows in background") instead of static scene descriptions.
- Per-scene cost breakdown in the confirmation prompt. Each scene now shows its estimated cost (Scene 1: ai_video $0.33, Scene 2: stock $0.00).
- Smart duration matching. Video providers declare their supported durations, and the resolver picks the smallest duration >= the scene's voiceover length. Never loops AI video.
- Video generation telemetry in log.json: timing, provider, success/failure, and fallback chain per scene.
- New CLI flags: `--video-provider`, `--video-model`, `--no-video`.
- Web UI: new "AV" badge for AI video scenes, video asset URLs in scene preview.

### Changed
- Creative director prompt is now cost-aware about video. It only suggests `ai_video` when video providers are available, and recommends 1-3 video scenes per Short where motion adds real value.
- `optimizeImagePrompt()` now takes an options bag (`{ mode, rejectionContext }`) instead of a trailing optional parameter. Existing callers updated.
- Cost estimator includes video generation cost in totals and per-scene breakdowns.

### Fixed
- Anti-loop guard in score-to-props.ts was ineffective due to mutation-before-read bug. The capped duration is now computed from the original value.
- Video model override (`--video-model`) no longer leaks to the secondary provider. Only the primary provider receives the user-specified model.
- Web UI SceneCard, scene-assets, and useApi type now handle `ai_video` visual type (enum completeness fix).
- StockVideoBeat no longer loops AI-generated video clips, preventing visible seam artifacts.

## [0.7.0] - 2026-04-03

### Added
- Vision-verified stock footage. The pipeline now uses a multimodal LLM to check whether stock footage actually matches what was requested before putting it in the video. No more toy rockets in your Artemis launch video.
- Query reformulation. When stock footage doesn't match, the pipeline automatically rewrites the search query in stock-API-friendly terms (strips proper nouns, uses concrete visual nouns) and retries.
- Multi-provider stock search. Both Pexels and Pixabay are searched when both API keys are configured. Query-first ordering tries the same query on all providers before reformulating.
- AI image fallback with negative examples. When all stock options fail verification, the pipeline falls back to AI image generation, feeding the VLM's rejection reasons into the image prompt for better results.
- Stock verification metadata in log.json. Every stock scene now logs what was tried, what was rejected, why, and whether it fell back to AI.
- New CLI flags: `--stock-verify` / `--no-stock-verify`, `--stock-confidence`, `--stock-max-attempts`, `--verification-model`.
- Lazy sequential downloading for stock candidates. Search returns metadata first, assets are downloaded one at a time and verified before downloading the next.
- Cost estimator now shows max additional cost if stock scenes fall back to AI generation.

### Changed
- Actual cost report now counts AI images from what was produced on disk (including stock fallbacks), not from what the director originally planned.

### For contributors
- `StockProvider` interface now returns `StockCandidate[]` (metadata without download) and has a `download()` method for lazy fetching. Both Pexels and Pixabay providers updated.
- `PipelineOptions.stock` changed from single `StockProvider` to `StockProvider[]` for multi-provider support.
- `createProviders()` factory constructs both stock providers when both API keys are available.
- Remotion score-to-props mapper detects when stock scenes fell back to AI images and renders them correctly as AIImageBeat instead of StockVideoBeat.

### Fixed
- OpenAI structured output schema rejection for the `transition` field (regression from v0.6.0). Changed `.nullish()` to `.nullable()` in both `director-score.ts` and `creative-director.ts`.

## [0.6.0] - 2026-04-03

### Changed
- The pipeline is now a Mastra workflow. Contributors can read the 6-stage flow (research, director, TTS, visuals, assembly, critic) as a declarative `.then()` chain instead of scrolling through 630 lines of imperative code. Same behavior, much easier to extend.
- LLM providers now use Vercel AI SDK 6 instead of raw Anthropic/OpenAI SDK calls. Structured output, web search, and token tracking all go through a unified `generateText()` API. Adding new LLM providers is simpler.
- Fixed an OpenAI structured output compatibility issue where the `transition` field on scenes was rejected by AI SDK 6's stricter schema validation.
- Pipeline utility functions (`splitWordsIntoScenes`, `getVideoDuration`, etc.) are now importable from `src/pipeline/utils.ts` for use outside the orchestrator.

### Added
- Mastra workflow framework (`@mastra/core`) for pipeline orchestration.
- Vercel AI SDK 6 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`) for unified LLM provider interface.

## [0.5.0] - 2026-04-02

### Added
- Background music for every generated video. 25 royalty-free tracks across 8 moods (epic cinematic, tense electronic, chill lofi, uplifting pop, mysterious ambient, warm acoustic, dark cinematic, dreamy ethereal), automatically selected from the creative director's mood tag.
- `--no-music` CLI flag and `noMusic` API option to generate videos without background music.
- Music manifest integrity check validates all referenced MP3 files exist on startup.
- Music selection progress event in SSE stream shows which track was picked and why.
- Selected music track info written to job `meta.json` for provenance.

### Changed
- `MusicMood` is now a strict 8-value enum instead of a free string. Creative director prompt updated with exact valid values to prevent LLM hallucination and retry costs.
- `MusicTrack.tsx` simplified to flat volume (0.15) instead of per-word ducking, which caused audible volume pumping during continuous voiceover.

## [0.4.0] - 2026-04-02

### Added
- Web UI with live pipeline visualization. Watch AI research, write, speak, and paint in real time across 6 stages. React + Tailwind frontend served from the same Docker image.
- REST API (Fastify) for programmatic job management. Create, list, monitor, cancel, and delete render jobs via `/api/v1/` endpoints.
- Server-Sent Events (SSE) streaming for real-time job progress. Each pipeline stage emits typed events as it runs.
- BullMQ job queue backed by Redis. Jobs survive restarts, support cancellation between stages, and auto-prune when `MAX_JOBS` is set.
- Background worker process runs rendering jobs independently from the CLI, with live progress callbacks.
- Bring-your-own-key (BYOK) support. Submit your own API keys per job without storing them server-side.
- Job gallery page with archetype color palette (14 distinct colors) and time-ago labels.
- Settings page for API key management (stored in browser localStorage).
- Download generated videos, images, and audio directly from the web UI.
- Health check endpoint (`/api/v1/health`) with Redis and filesystem status.
- Progressive reveal during rendering. Research summary, director score, and critic review appear in real time as each stage completes, so you can watch the AI think.
- Reconnecting clients recover full pipeline state automatically, no missed events.
- Three dedicated job views: running (progressive data reveal), completed (video player, quality review, cost breakdown), and failed (error details with the exact stage that broke).
- Scene cards with visual type badges show what's being generated (AI image, stock photo, stock video, or text card).

### Changed
- Docker Compose upgraded from single-service CLI to 3-service architecture (Redis + API + Worker) with shared job volume.
- Dockerfile builds the React frontend during image creation and serves it via Fastify.
- Pipeline timeline shows running substatus (e.g., "Rendering 450 frames") and connector lines between stages.

### For contributors
- Pipeline orchestrator uses a `PipelineCallbacks` interface with `onProgress` events, decoupling progress from terminal output.
- CLI entry point uses the shared provider factory and callback system.
- Imports alphabetized across all source files.

## [0.3.0] - 2026-04-01

### Added
- Docker containerization. Run `docker run --env-file .env --shm-size=2gb -v ./output:/output openreels "your topic"` on any platform with Docker installed. No Node.js, Chrome, or ffmpeg setup required.
- `--yes` / `-y` CLI flag to auto-confirm cost estimation prompt for non-interactive environments (Docker, CI).
- Startup API key validation that checks required keys based on selected providers before any API calls, with clear error table showing missing keys and signup URLs.
- `--preview` flag now detects non-interactive terminals and skips gracefully instead of hanging.
- GitHub Actions workflow for building and pushing Docker images to GHCR on release.
- docker-compose.yml with pre-configured shared memory, output volume, and stock asset cache.

### Changed
- `.env.example` now includes provider signup URLs and Docker usage instructions, so you know exactly where to get each key.

## [0.2.0] - 2026-04-01

### Added
- Scene transitions between beats. Videos now use crossfade, slide, wipe, and flip transitions instead of hard cuts. The Creative Director selects transitions per scene based on emotional content, with each archetype providing sensible defaults.
- Remotion `TransitionSeries` replaces raw `Sequence` assembly, with overlap-aware duration calculation that prevents voiceover truncation.
- Full test suite for the score-to-props mapper (12 new tests covering transition cascade, duration calculation, and voiceover clamp).

### Changed
- `DirectorScore` schema extended with optional `transition` field per scene (backward-compatible).
- All 14 archetype configs now include `defaultTransition` and `transitionDurationFrames`.
- `getTotalDurationInFrames` accounts for transition overlaps and extends the last scene to prevent black frames.

## [0.1.1] - 2026-04-01

### Added
- Inworld TTS as an alternative voice provider (`--tts-provider inworld`). Native word-level timestamps, MP3 output, 15-language support. Includes response validation and a 2000-character input guard.
- Provider key type aliases (`LLMProviderKey`, `TTSProviderKey`, `ImageProviderKey`) for DRY type usage across CLI, pipeline, and cost estimation.
- Cost estimation support for Inworld TTS pricing.

## [0.1.0] - 2026-03-31

### Added
- Give it a topic, get a fully rendered YouTube Short. Research, script, voiceover, visuals, captions, and assembly in one command.
- 14 visual archetypes covering factual, narrative, stylized, dramatic, and aesthetic content: editorial-caricature, warm-narrative, studio-realism, infographic, anime-illustration, pastoral-watercolor, comic-book, gothic-fantasy, vintage-snapshot, surreal-dreamscape, warm-editorial, cinematic-documentary, moody-cinematic, bold-illustration.
- 6 animated caption styles: bold-outline, color-highlight, clean, karaoke-sweep, gradient-rise, block-impact. Each renders word-level synchronized captions from TTS timestamps.
- DirectorScore system: the LLM generates a per-scene production plan with variety enforcement (no 3+ consecutive same visual type) and automatic retry on validation failure.
- 5 AI agents working together: research (web-grounded facts), creative director (script + scene planning), image prompter (matches visuals to archetype style), critic (scores output against a rubric), plus a content playbook for style guidance.
- Dual LLM provider support: Anthropic Claude (with native web search) and OpenAI GPT-4.1 (with two-pass web search via gpt-4o-search-preview).
- ElevenLabs TTS with word-level timestamps and character-to-word aggregation for precise caption sync.
- Gemini Flash image generation with archetype style bible context.
- Pexels and Pixabay stock providers with local caching and portrait-orientation preference.
- Remotion-based video renderer with scene beats (AI image, stock image, stock video, text card), music ducking, and configurable platform output (YouTube Shorts default).
- CLI with --archetype override, --provider selection, --dry-run mode, --preview for Remotion Studio, and real-time progress display.
- Cost estimation (pre-run) and actual cost reporting (post-run) for LLM, TTS, and image generation.
- Vitest test suite covering archetype registry, DirectorScore schema validation, caption timing utilities, playbook parsing, and cost estimation.

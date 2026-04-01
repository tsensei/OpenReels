# Changelog

All notable changes to OpenReels will be documented in this file.

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

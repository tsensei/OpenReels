# Changelog

All notable changes to OpenReels will be documented in this file.

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

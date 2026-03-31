# OpenReels

Open-source AI pipeline that turns any topic into a fully rendered YouTube Short — research, script, voiceover, images, captions, and video assembly in one command.

## What it does

Give it a topic. It handles everything else:

1. **Research** — web search to ground the script in real facts
2. **Script** — writes a punchy, language-aware short-form script
3. **Voiceover** — generates TTS audio with word-level timestamps
4. **Visuals** — creates AI images matched to each scene
5. **Captions** — renders styled, animated captions with proper Unicode/CJK/RTL support
6. **Assembly** — composites everything into a vertical MP4 via Remotion
7. **Critique** — an AI critic scores the output and re-runs the pipeline if quality is below threshold

```
openreels "OpenAI shut down Sora to redirect compute into robotics — why they killed their most hyped product" --archetype editorial_caricature
```

Topic in, MP4 out. No editing.

## Quickstart

**Prerequisites:** Node.js 22+, pnpm, ffprobe (for stock video duration detection)

```bash
git clone https://github.com/tsensei/OpenReels.git
cd OpenReels
pnpm install
cp .env.example .env   # fill in your API keys
```

**Required API keys** (at minimum):
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (LLM provider)
- `ELEVENLABS_API_KEY` (text-to-speech)
- `GOOGLE_API_KEY` (Gemini image generation)

**Optional:** `PEXELS_API_KEY`, `PIXABAY_API_KEY` (stock footage, free registration)

```bash
# Full pipeline run
pnpm start "5 stoic lessons that changed my life"

# Dry run (outputs DirectorScore JSON, no API spend on assets)
pnpm start "your topic" --dry-run

# With specific archetype and provider
pnpm start "your topic" --archetype anime_illustration --provider openai
```

### CLI flags

| Flag | Description | Default |
|------|-------------|---------|
| `--archetype <name>` | Override visual archetype | LLM chooses |
| `--provider <name>` | LLM provider (`anthropic` or `openai`) | `anthropic` |
| `--platform <name>` | Target platform (`youtube`, `tiktok`, `instagram`) | `youtube` |
| `--dry-run` | Output DirectorScore JSON without generating assets | off |
| `--preview` | Open Remotion Studio after rendering | off |
| `--verbose` | Verbose output | off |
| `-o, --output <dir>` | Output directory | `./output` |

## Archetypes

14 visual styles that control colors, captions, motion, lighting, and AI image prompting:

| Archetype | Best for |
|-----------|----------|
| `editorial_caricature` | News commentary, satire, social issues |
| `warm_narrative` | Storytelling, history, human interest |
| `studio_realism` | Professional photography, editorial, luxury |
| `infographic` | Data, facts, explainers, rapid-fire content |
| `anime_illustration` | Dynamic, action-oriented, pop culture |
| `pastoral_watercolor` | Nature, contemplative, hand-painted aesthetic |
| `comic_book` | Action, adventure, energetic content |
| `gothic_fantasy` | Dark themes, mythology, epic content |
| `vintage_snapshot` | Nostalgic, intimate, personal stories |
| `surreal_dreamscape` | Sci-fi, fantasy, mind-bending topics |
| `warm_editorial` | Lifestyle, people stories, general purpose |
| `cinematic_documentary` | Factual, historical, science |
| `moody_cinematic` | Mystery, tension, crime, dark history |
| `bold_illustration` | Educational, how-to, listicles |

## Background

OpenReels is a full rewrite and open-source rebrand of [ReelMistri](https://github.com/tsensei/ReelMistri/), a CLI pipeline originally built for Bangla-language YouTube Shorts automation. ReelMistri proved the concept: one command, fully produced video, language-aware scripts, culturally coherent visuals, proper Bengali text rendering.

The rewrite moves from Python to TypeScript for native [Remotion](https://www.remotion.dev/) integration. Cleaner video rendering, better developer experience, no Python-to-TypeScript bridge.

## Status

v0.1.0 shipped. The core pipeline works end-to-end. See [CHANGELOG.md](CHANGELOG.md) for details and [TODOS.md](TODOS.md) for known issues.

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) — free for personal, educational, research, and non-profit use.

For commercial or for-profit use, a separate license is required. Contact **talhajsiam@gmail.com** for licensing inquiries.

# OpenReels

Open-source AI pipeline that turns any topic into a fully rendered YouTube Short. Includes a web UI with live pipeline visualization, REST API, and CLI.

## Demo

<div align="center">


https://github.com/user-attachments/assets/189967cd-de41-4ce1-b2c4-33f40b6c19a9


**Topic in, MP4 out.** This video was generated in a single command:

```bash
openreels "The photographer who tricked the entire art world with AI — and won first place \
at the Sony World Photography Award, only to reveal it was AI-generated and refuse the prize" \
--archetype editorial_caricature
```

</div>

## What it does

Give it a topic. It handles everything else:

1. **Research** — web search to ground the script in real facts
2. **Script** — writes a punchy, language-aware short-form script
3. **Voiceover** — generates TTS audio with word-level timestamps
4. **Visuals** — creates AI images, generates AI video clips (image-to-video via Google Veo or fal.ai), and verifies stock footage with a vision model before using it (rejects bad matches, retries with reformulated queries, falls back to AI generation)
5. **Captions** — renders styled, animated captions with proper Unicode/CJK/RTL support
6. **Assembly** — composites everything into a vertical MP4 via Remotion, with scene transitions (crossfade, slide, wipe, flip)
7. **Critique** — an AI critic scores the output and re-runs the pipeline if quality is below threshold

```
openreels "OpenAI shut down Sora to redirect compute into robotics — why they killed their most hyped product" --archetype editorial_caricature
```

Topic in, MP4 out. No editing.

## Quickstart

### Web UI (recommended)

Launch the full web interface with Docker Compose. No Node.js, Chrome, or ffmpeg required.

```bash
git clone https://github.com/tsensei/OpenReels.git
cd OpenReels
cp .env.example .env   # fill in your API keys
docker compose up      # starts Redis + API + Worker
# Open http://localhost:3000
```

Type a topic, pick an archetype, and watch the pipeline run in real time. Research, script, voiceover, visuals, and assembly stages stream live progress to the browser.

### Docker CLI (single run)

```bash
cp .env.example .env   # fill in your API keys

docker run --env-file .env --shm-size=2gb -v ./output:/output ghcr.io/tsensei/openreels "5 stoic lessons that changed my life"
```

Or run the CLI through Docker Compose:

```bash
docker compose run worker npx tsx src/index.ts --yes "5 stoic lessons that changed my life"
```

### Local development

**Prerequisites:** Node.js 22+, pnpm, ffprobe (for stock video duration detection)

```bash
git clone https://github.com/tsensei/OpenReels.git
cd OpenReels
pnpm install
cp .env.example .env   # fill in your API keys
```

```bash
# Full pipeline run
pnpm start "5 stoic lessons that changed my life"

# Dry run (outputs DirectorScore JSON, no API spend on assets)
pnpm start "your topic" --dry-run

# With specific archetype and provider
pnpm start "your topic" --archetype anime_illustration --provider openai
```

### API keys

**Required** (at minimum):
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` or `GOOGLE_API_KEY` — [Anthropic](https://console.anthropic.com/) / [OpenAI](https://platform.openai.com/api-keys) / [Google AI Studio](https://aistudio.google.com/apikey)
- `ELEVENLABS_API_KEY` or `INWORLD_TTS_API_KEY` — [ElevenLabs](https://elevenlabs.io/) / [Inworld](https://inworld.ai/). Or use `--tts-provider kokoro` for free local TTS (no key needed), `--tts-provider openai-tts` (reuses `OPENAI_API_KEY`), or `--tts-provider gemini-tts` (reuses `GOOGLE_API_KEY`).
- `GOOGLE_API_KEY` — also needed for Gemini image generation, AI video (Veo), and Gemini TTS. Use `--provider google` to run LLM + image + video with one key.

**Optional:** `PEXELS_API_KEY` ([Pexels](https://www.pexels.com/api/)), `PIXABAY_API_KEY` ([Pixabay](https://pixabay.com/api/docs/)) for stock footage (free registration), `FAL_API_KEY` ([fal.ai](https://fal.ai/)) for AI video generation via Kling

### CLI flags

| Flag | Description | Default |
|------|-------------|---------|
| `--archetype <name>` | Override visual archetype | LLM chooses |
| `--provider <name>` | LLM provider (`anthropic`, `openai`, `gemini`, `google` for all-Gemini, or `local` for free local TTS) | `anthropic` |
| `--tts-provider <name>` | TTS provider (`elevenlabs`, `inworld`, `kokoro`, `gemini-tts`, `openai-tts`) | `elevenlabs` |
| `--platform <name>` | Target platform (`youtube`, `tiktok`, `instagram`) | `youtube` |
| `--dry-run` | Output DirectorScore JSON without generating assets | off |
| `--preview` | Open Remotion Studio after rendering | off |
| `-o, --output <dir>` | Output directory | `./output` |
| `--image-provider <name>` | Image provider (`gemini` or `openai`) | `gemini` |
| `--no-music` | Disable background music | music on |
| `--no-stock-verify` | Disable VLM stock footage verification | verify on |
| `--stock-confidence <n>` | Min confidence threshold for stock verification (0-1) | `0.6` |
| `--stock-max-attempts <n>` | Max stock API calls per scene | `4` |
| `--verification-model <model>` | Model override for stock verification VLM | same as `--provider` |
| `--video-provider <name>` | Video provider (`gemini` or `fal`) | auto-detect from keys |
| `--video-model <model>` | Video model override | provider default |
| `--kokoro-voice <voice>` | Kokoro voice preset (e.g. `af_heart`, `bf_emma`, `am_fenrir`) | `af_heart` |
| `--no-video` | Disable AI video generation | video on |
| `-y, --yes` | Auto-confirm cost estimation (for Docker/CI) | off |

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

v0.10.0 shipped. Unified TTS alignment layer with Kokoro (free local TTS), Gemini TTS, and OpenAI TTS providers. Any TTS provider now gets word-level timestamps automatically via Whisper forced alignment. Use `--provider local` for zero-cost voiceover. See [CHANGELOG.md](CHANGELOG.md) for details and [TODOS.md](TODOS.md) for known issues.

## License

This project is licensed under the [MIT License](LICENSE).

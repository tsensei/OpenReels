# OpenReels

[![GitHub stars](https://img.shields.io/github/stars/tsensei/OpenReels?style=flat&color=f5c542)](https://github.com/tsensei/OpenReels/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.13.1-green.svg)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-288%20passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)]()
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)]()

Open-source AI pipeline that turns any topic into a publish-ready YouTube/Instagram/TikTok Short. One command. Research, script, voiceover, AI-generated visuals, AI-generated music, animated captions, scene transitions. Out comes a vertical MP4, ready to upload.

Web UI with live pipeline visualization, REST API, Docker, and CLI. Bring your own API keys.

## Demo

<div align="center">


https://github.com/user-attachments/assets/c4df8893-7764-43c3-b004-ef610fec710f


**Topic in, MP4 out.** This video was generated in a single command:

```bash
openreels "the apollo 13 disaster, from explosion to miraculous return" --provider google
```

</div>

### Web UI

<div align="center">
<img src=".github/assets/demo.gif" alt="OpenReels Web UI demo" width="800" />

**Live pipeline visualization.** Watch research, script, voiceover, visuals, music, and assembly stages stream in real time.
</div>

<details>
<summary><strong>Screenshots</strong></summary>

<table>
<tr>
<td><img src=".github/assets/home.png" alt="Home page" width="400" /></td>
<td><img src=".github/assets/pipeline.png" alt="Pipeline running" width="400" /></td>
</tr>
<tr>
<td align="center"><em>Topic input with archetype gallery</em></td>
<td align="center"><em>Live pipeline with storyboard</em></td>
</tr>
<tr>
<td><img src=".github/assets/pipeline_completed.png" alt="Pipeline completed" width="400" /></td>
<td><img src=".github/assets/gallery.png" alt="Gallery view" width="400" /></td>
</tr>
<tr>
<td align="center"><em>Completed: video player, cost breakdown, quality review</em></td>
<td align="center"><em>Gallery with multiple generations</em></td>
</tr>
</table>

</details>

## How it works

Give it a topic. It handles everything:

| Stage | What happens |
|-------|-------------|
| **Research** | Web search grounds the script in real facts, not hallucinations |
| **Script** | Writes a punchy short-form script with scene breakdowns, visual direction, and emotional arc |
| **Voiceover** | Generates TTS audio with word-level timestamps for karaoke-style captions |
| **Visuals** | AI images (Gemini, DALL-E), AI video clips (Google Veo 3.1, fal.ai Kling 2.6 Pro) with dedicated cinematography prompts and negative prompt guidance, plus vision-verified stock footage that rejects bad matches and retries automatically |
| **Music** | AI-generated background score via Google Lyria 3 Pro, scene-synced to match the video's emotional arc. Or pick from 25 bundled royalty-free tracks |
| **Captions** | Spring-animated 3-state captions with 7 distinct styles, per-archetype theming, and word-level karaoke highlighting |
| **Assembly** | Composites everything into a vertical MP4 via Remotion with crossfade, slide, wipe, and flip transitions |
| **Critique** | AI critic scores the output. If quality is below threshold, the pipeline re-runs |

Every stage streams live progress to the web UI. You watch the AI research, write, paint, compose, and render in real time.

## Provider flexibility

Mix and match providers or go all-in on one ecosystem:

| Capability | Providers |
|-----------|-----------|
| **LLM** | Anthropic Claude, OpenAI GPT, Google Gemini, OpenRouter (300+ models), any OpenAI-compatible endpoint |
| **Search** | Native (provider built-in), Tavily, or parametric knowledge |
| **TTS** | ElevenLabs, Inworld, OpenAI TTS, Gemini TTS, Kokoro (free, local) |
| **Images** | Gemini Imagen, OpenAI DALL-E |
| **Video** | Google Veo 3.1, fal.ai Kling 2.6 Pro (with cross-provider fallback, negative prompts, structured cinematography prompts) |
| **Music** | Google Lyria 3 Pro (AI-generated, $0.08/track), Bundled library (free) |
| **Stock** | Pexels, Pixabay (both searched, vision-verified, with AI fallback) |

**One key, everything Google:** `--provider google` sets LLM, images, TTS, video, and music to Google APIs with a single `GOOGLE_API_KEY`.

**Zero-cost voiceover:** `--provider local` uses Kokoro for free local TTS. No API key needed.

## Quickstart

### Web UI (recommended)

```bash
git clone https://github.com/tsensei/OpenReels.git
cd OpenReels
cp .env.example .env   # fill in your API keys
docker compose up      # starts Redis + API + Worker
# Open http://localhost:3000
```

Type a topic, pick your providers, and watch the pipeline run. Research, script, voiceover, visuals, music, and assembly stages stream live to the browser. Download the final video when it's done.

### Docker CLI (single run)

```bash
cp .env.example .env   # fill in your API keys

docker run --env-file .env --shm-size=2gb -v ./output:/output ghcr.io/tsensei/openreels "5 stoic lessons that changed my life"
```

Or run through Docker Compose:

```bash
docker compose run worker npx tsx src/index.ts --yes "5 stoic lessons that changed my life"
```

### Local development

**Prerequisites:** Node.js 22+, pnpm, ffprobe

```bash
git clone https://github.com/tsensei/OpenReels.git
cd OpenReels
pnpm install
cp .env.example .env   # fill in your API keys
```

```bash
# Full pipeline with AI music
pnpm start "the fall of the Roman Empire" --provider google

# Free local TTS, no API spend on voiceover
pnpm start "5 stoic lessons" --provider local

# Dry run (outputs DirectorScore JSON, no asset generation)
pnpm start "your topic" --dry-run

# Specific archetype and provider combo
pnpm start "your topic" --archetype anime_illustration --provider openai
```

### API keys

**Minimum to run** (pick one LLM + one TTS):
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` or `GOOGLE_API_KEY` — [Anthropic](https://console.anthropic.com/) / [OpenAI](https://platform.openai.com/api-keys) / [Google AI Studio](https://aistudio.google.com/apikey)
- `ELEVENLABS_API_KEY` or `INWORLD_TTS_API_KEY` — [ElevenLabs](https://elevenlabs.io/) / [Inworld](https://inworld.ai/). Or use `--tts-provider kokoro` (free, no key), `--tts-provider openai-tts`, or `--tts-provider gemini-tts`
- `GOOGLE_API_KEY` — also needed for Gemini image generation, AI video (Veo), AI music (Lyria), and Gemini TTS

**Optional:** `PEXELS_API_KEY` ([Pexels](https://www.pexels.com/api/)), `PIXABAY_API_KEY` ([Pixabay](https://pixabay.com/api/docs/)) for stock footage, `FAL_API_KEY` ([fal.ai](https://fal.ai/)) for Kling video generation

### CLI flags

| Flag | Description | Default |
|------|-------------|---------|
| `--provider <name>` | LLM provider (`anthropic`, `openai`, `gemini`, `openrouter`, `openai-compatible`, `google`, `local`) | `anthropic` |
| `--llm-model <model>` | Model ID override (e.g. `anthropic/claude-sonnet-4` for OpenRouter) | provider default |
| `--llm-base-url <url>` | Base URL for `openai-compatible` (e.g. `http://localhost:11434/v1`) | — |
| `--search-provider <name>` | Search provider (`native`, `tavily`, `none`) | auto-detect |
| `--image-provider <name>` | Image provider (`gemini`, `openai`) | `gemini` |
| `--tts-provider <name>` | TTS provider (`elevenlabs`, `inworld`, `kokoro`, `gemini-tts`, `openai-tts`) | `elevenlabs` |
| `--music-provider <name>` | Music provider (`bundled`, `lyria`) | `bundled` |
| `--video-provider <name>` | Video provider (`gemini`, `fal`) | auto-detect |
| `--archetype <name>` | Override visual archetype | LLM chooses |
| `--platform <name>` | Target platform (`youtube`, `tiktok`, `instagram`) | `youtube` |
| `--dry-run` | Output DirectorScore JSON without generating assets | off |
| `--preview` | Open Remotion Studio after rendering | off |
| `-o, --output <dir>` | Output directory | `./output` |
| `--no-music` | Disable background music | music on |
| `--no-video` | Disable AI video generation | video on |
| `--no-stock-verify` | Disable VLM stock footage verification | verify on |
| `--stock-confidence <n>` | Min confidence for stock verification (0-1) | `0.6` |
| `--stock-max-attempts <n>` | Max stock API calls per scene | `4` |
| `--video-model <model>` | Video model override | provider default |
| `--kokoro-voice <voice>` | Kokoro voice preset | `af_heart` |
| `-y, --yes` | Auto-confirm cost estimation (Docker/CI) | off |

## Cost transparency

Before spending any money, the pipeline shows a detailed cost breakdown and asks for confirmation:

```
Estimated cost: $0.686
  LLM:    $0.0029 (7 calls)
  TTS:    $0.0171 (853 chars)
  Images: $0.3030 (3 AI images @ $0.101/ea)
  Video:  $0.3000 (1 AI videos)
  Music:  $0.0802 (Lyria AI generation)
  Stock:  free
```

After rendering, actual cost is computed from real token usage. Use `--dry-run` to preview the DirectorScore without spending anything.

## Archetypes

14 visual styles that control colors, captions, motion, lighting, and AI image prompting. Same topic, four different archetypes:

<div align="center">
<table>
<tr>
<td><img src=".github/assets/kaldi_cinematic.jpg" alt="Cinematic Documentary" width="180" /></td>
<td><img src=".github/assets/kaldi_anime.jpg" alt="Anime Illustration" width="180" /></td>
<td><img src=".github/assets/kaldi_surreal.jpg" alt="Surreal Dreamscape" width="180" /></td>
<td><img src=".github/assets/kaldi_vintage.jpg" alt="Vintage Snapshot" width="180" /></td>
</tr>
<tr>
<td align="center"><em>Cinematic Documentary</em></td>
<td align="center"><em>Anime Illustration</em></td>
<td align="center"><em>Surreal Dreamscape</em></td>
<td align="center"><em>Vintage Snapshot</em></td>
</tr>
</table>
</div>

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

OpenReels is a full rewrite of [ReelMistri](https://github.com/tsensei/ReelMistri/), a CLI pipeline originally built for Bangla-language YouTube Shorts automation. ReelMistri proved the concept: one command, fully produced video, language-aware scripts, culturally coherent visuals, proper Bengali text rendering.

The rewrite moves from Python to TypeScript for native [Remotion](https://www.remotion.dev/) integration. Cleaner video rendering, better developer experience, no Python-to-TypeScript bridge.

## Status

v0.17.0 shipped. See [CHANGELOG.md](CHANGELOG.md) for full version history and [TODOS.md](TODOS.md) for known issues and roadmap.

## Star History

If OpenReels is useful to you, consider giving it a star. It helps others discover the project.

[![Star History Chart](https://api.star-history.com/svg?repos=tsensei/OpenReels&type=Date)](https://star-history.com/#tsensei/OpenReels&Date)

## License

This project is licensed under the [MIT License](LICENSE).

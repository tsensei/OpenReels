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
4. **Visuals** — creates AI images matched to each scene
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

**Prerequisites:** Node.js 22+, pnpm, ffprobe (for stock video duration detection), Python 3.11 or 3.12 (only required for `--tts-provider chatterbox` — Python 3.13+ is not supported due to PyTorch/OpenMP issues)

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
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — [Anthropic](https://console.anthropic.com/) / [OpenAI](https://platform.openai.com/api-keys)
- `ELEVENLABS_API_KEY` or `INWORLD_TTS_API_KEY` — [ElevenLabs](https://elevenlabs.io/) / [Inworld](https://inworld.ai/)
- `GOOGLE_API_KEY` — [Google AI Studio](https://aistudio.google.com/apikey) (Gemini image generation)

**Optional:** `PEXELS_API_KEY` ([Pexels](https://www.pexels.com/api/)), `PIXABAY_API_KEY` ([Pixabay](https://pixabay.com/api/docs/)) for stock footage (free registration)

### Zero-API-key local mode (Ollama + Chatterbox)

Run the full pipeline with **no API keys** using local open-source models.

#### One-time setup

```bash
# 1. Install and start Ollama (macOS)
brew install ollama
ollama serve   # keep running in a separate terminal

# 2. Pull your preferred LLM model (one-time — pick one)
ollama pull llama3.1:8b     # ~5 GB, fast and reliable
ollama pull gemma3:9b       # ~6 GB, good quality
ollama pull qwen2.5:7b      # ~5 GB, multilingual

# 3. Pull an image generation model — macOS only (one-time — pick one)
ollama pull x/flux2-klein:4b    # ~6 GB, fastest
ollama pull x/flux2-klein:9b    # ~12 GB, higher quality
ollama pull x/z-image-turbo:fp8     # ~13 GB, photorealistic
```

> **Interactive model selection:** When you run with `--provider ollama`, OpenReels will show you all pulled models and let you choose interactively. No need to memorise model names.

> **Chatterbox is auto-installed:** OpenReels automatically creates an isolated Python venv at `~/.openreels/chatterbox-venv` and installs `chatterbox-tts` on first use. You only need Python 3.11 or 3.12 on your system (`brew install python@3.12` on macOS). Python 3.13+ is not supported.

> **First run note:** Chatterbox Turbo downloads ~1.5 GB of model weights on first use. This is automatic and cached locally (`~/.cache/huggingface/`). Expect 2–5 minutes on a typical connection.

> **GPU recommended:** Chatterbox is significantly faster on Apple Silicon (MPS) or a CUDA GPU. CPU generation works but is slow (10–30× slower than real-time).

#### Running with no API keys

```bash
# Interactive — OpenReels will prompt you to choose a model and describe your topic
pnpm start "your topic" \
  --provider ollama \
  --tts-provider chatterbox \
  --image-provider ollama

# Non-interactive — supply context via --brief and pin specific models
pnpm start "your topic" \
  --provider ollama \
  --tts-provider chatterbox \
  --image-provider ollama \
  --ollama-model llama3.1:8b \
  --ollama-image-model x/flux2-klein:4b \
  --brief "Solar panels cost $10k upfront but save $50k over 20 years. Mood: informative."
```

> **Linux/Windows users:** Ollama image generation is currently macOS-only. Use `--image-provider gemini` (free tier available) or `--image-provider openai` instead, and provide the relevant API key.

#### Mix and match — combine free and paid providers

Each provider is independent. You can freely mix local and cloud options to get the best trade-off between cost, speed, and quality.

```bash
# Best quality script + free TTS + free images (macOS for now)
# Requires: ANTHROPIC_API_KEY
pnpm start "your topic" \
  --provider anthropic \
  --tts-provider chatterbox \
  --image-provider ollama

# Free script + paid TTS for higher quality voice + free images (macOS for now)
# Requires: ELEVENLABS_API_KEY
pnpm start "your topic" \
  --provider ollama \
  --tts-provider elevenlabs \
  --image-provider ollama

# Free everything on Linux/Windows (Ollama image gen is macOS-only, use Gemini instead)
# Requires: GOOGLE_API_KEY
pnpm start "your topic" \
  --provider ollama \
  --tts-provider chatterbox \
  --image-provider gemini

# Free script + free TTS + best image quality (OpenAI DALL-E)
# Requires: OPENAI_API_KEY
pnpm start "your topic" \
  --provider ollama \
  --tts-provider chatterbox \
  --image-provider openai
```

### CLI flags

| Flag | Description | Default |
|------|-------------|---------|
| `--archetype <name>` | Override visual archetype | LLM chooses |
| `--provider <name>` | LLM provider (`anthropic`, `openai`, `ollama`) | `anthropic` |
| `--tts-provider <name>` | TTS provider (`elevenlabs`, `inworld`, `chatterbox`) | `elevenlabs` |
| `-i, --image-provider <name>` | Image provider (`gemini`, `openai`, `ollama`) | `gemini` |
| `--platform <name>` | Target platform (`youtube`, `tiktok`, `instagram`) | `youtube` |
| `--dry-run` | Output DirectorScore JSON without generating assets | off |
| `--preview` | Open Remotion Studio after rendering | off |
| `-o, --output <dir>` | Output directory | `./output` |
| `-y, --yes` | Auto-confirm cost estimation (for Docker/CI) | off |
| `--brief <text>` | Topic context for Ollama mode (skips interactive prompt) | — |
| `--ollama-model <name>` | Ollama LLM model name | interactive selection |
| `--ollama-image-model <name>` | Ollama image generation model name | interactive selection |
| `--ollama-host <url>` | Ollama API host URL | `http://localhost:11434` |
| `--chatterbox-device <device>` | PyTorch device for Chatterbox (`cpu`, `cuda`, `mps`) | auto-detected |
| `--chatterbox-audio-prompt <path>` | Reference WAV for Chatterbox voice cloning (5–10s) | — |

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

v0.4.0 shipped. The core pipeline works end-to-end with a web UI, REST API, and Docker Compose for one-command usage on any platform. See [CHANGELOG.md](CHANGELOG.md) for details and [TODOS.md](TODOS.md) for known issues.

## License

This project is licensed under the [MIT License](LICENSE).

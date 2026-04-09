# OpenReels

Open-source AI pipeline that turns any topic into a fully rendered YouTube Short. Includes a web UI with live pipeline visualization, REST API, and CLI.

## Project structure

```
src/
  index.ts              # CLI entry point
  server.ts             # Fastify REST API server
  worker.ts             # BullMQ job worker
  cli/                  # args parser, progress display, cost estimator
  agents/               # creative-director, critic, image-prompter, music-prompter, research
  pipeline/             # Mastra workflow orchestrator + utils + music-resolver (6-stage pipeline)
  providers/
    factory.ts          # provider factory with BYOK support
    llm/                # base.ts (BaseLLM), anthropic.ts, openai.ts, gemini.ts (AI SDK 6)
    tts/                # elevenlabs.ts, inworld.ts, kokoro.ts, gemini.ts, openai.ts, aligned-tts-provider.ts, whisper-aligner.ts
    image/              # gemini.ts, openai.ts
    stock/              # pexels.ts, pixabay.ts, adaptive-resolver.ts, query-reformer.ts, stock-verifier.ts
    music/              # lyria.ts (Lyria 3 Pro), bundled-adapter.ts, bundled.ts
    video/              # gemini.ts (Veo), fal.ts (Kling), video-resolver.ts
  config/
    archetypes/         # 14 archetype JSON configs
    archetype-registry.ts
    playbook.ts, platforms.ts
  schema/               # director-score.ts, archetype.ts, providers.ts
  remotion/
    compositions/       # OpenReelsVideo.tsx (main composition)
    beats/              # AIImageBeat, StockImageBeat, StockVideoBeat, TextCardBeat
    captions/           # 7 caption styles + CaptionWrapper + timing utils
    audio/              # MusicTrack (ducking), VoiceoverTrack
    lib/                # score-to-props mapper, font loading
web/                    # React + Tailwind SPA (Vite)
  src/
    pages/              # HomePage, JobPage, GalleryPage, SettingsPage
    hooks/              # useApi, useSSE
    components/         # Layout, StageCard, pipeline/, shadcn/ui
    lib/                # scene-assets, utils
prompts/                # system prompts for each agent + playbook
fixtures/               # sample DirectorScore JSONs
```

## Commands

```bash
pnpm install          # install dependencies
pnpm start "topic"    # run full pipeline (CLI)
pnpm test             # run vitest suite (349 tests)
```

### Web UI (Docker Compose)

```bash
docker compose up     # starts Redis + API + Worker
# Open http://localhost:3000
```

### CLI (Docker)

```bash
docker build -t openreels .
docker run --env-file .env --shm-size=2gb -v ./output:/output openreels "topic"
docker compose run worker npx tsx src/index.ts --yes "topic"
```

## Testing

Test files are colocated with source: `*.test.ts` suffix, vitest with `describe/it/expect`.
Config: `vitest.config.ts`. Run: `npx vitest run`.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review

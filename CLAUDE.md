# OpenReels

Open-source AI pipeline that turns any topic into a fully rendered YouTube Short.

## Project structure

```
src/
  index.ts              # CLI entry point
  cli/                  # args parser, progress display, cost estimator
  agents/               # creative-director, critic, image-prompter, research
  pipeline/             # orchestrator (6-stage pipeline)
  providers/
    llm/                # anthropic.ts, openai.ts
    tts/                # elevenlabs.ts
    image/              # gemini.ts
    stock/              # pexels.ts, pixabay.ts
  config/
    archetypes/         # 14 archetype JSON configs
    archetype-registry.ts
    playbook.ts, platforms.ts
  schema/               # director-score.ts, archetype.ts, providers.ts
  remotion/
    compositions/       # OpenReelsVideo.tsx (main composition)
    beats/              # AIImageBeat, StockImageBeat, StockVideoBeat, TextCardBeat
    captions/           # 6 caption styles + timing utils
    audio/              # MusicTrack (ducking), VoiceoverTrack
    lib/                # score-to-props mapper, font loading
prompts/                # system prompts for each agent + playbook
fixtures/               # sample DirectorScore JSONs
```

## Commands

```bash
pnpm install          # install dependencies
pnpm start "topic"    # run full pipeline
pnpm test             # run vitest suite (38 tests)
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

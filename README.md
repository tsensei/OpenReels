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
openreels generate "OpenAI shut down Sora to redirect compute into robotics — why they killed their most hyped product" --lang en --archetype editorial_caricature
```

Topic in → MP4 out. No editing.

## Background

OpenReels is a full rewrite and open-source rebrand of [ReelMistri](https://github.com/tsensei/ReelMistri/) — a CLI pipeline originally built for Bangla-language YouTube Shorts automation. ReelMistri proved the concept: one command, fully produced video, language-aware scripts, culturally coherent visuals, proper Bengali text rendering.

The rewrite moves from Python to TypeScript for native [Remotion](https://www.remotion.dev/) integration — cleaner video rendering, better developer experience, no Python-to-TypeScript bridge.

## Status

Under active development. Coming soon.

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) — free for personal, educational, research, and non-profit use.

For commercial or for-profit use, a separate license is required. Contact **talhajsiam@gmail.com** for licensing inquiries.

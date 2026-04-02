#!/usr/bin/env python3
"""
Chatterbox Turbo TTS bridge for OpenReels.

Generates speech from text using ResembleAI's Chatterbox Turbo model and writes:
  - A WAV audio file
  - A JSON file containing approximate word-level timestamps

Usage:
    python scripts/chatterbox_tts.py \
        --text "Your script here" \
        --out /tmp/output.wav \
        --timestamps /tmp/timestamps.json \
        [--device cpu|cuda|mps] \
        [--audio-prompt /path/to/reference.wav]

First run will download ~1.5 GB of model weights automatically.
Subsequent runs use the cached weights (usually ~/.cache/huggingface/).

Requirements:
    pip install chatterbox-tts
"""

import argparse
import json
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="Chatterbox Turbo TTS bridge")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--out", required=True, help="Output WAV file path")
    parser.add_argument("--timestamps", required=True, help="Output JSON timestamps file path")
    parser.add_argument(
        "--device",
        default="cpu",
        choices=["cpu", "cuda", "mps"],
        help="PyTorch device (default: cpu; use mps on Apple Silicon, cuda on NVIDIA GPU)",
    )
    parser.add_argument(
        "--audio-prompt",
        default=None,
        help="Optional path to a reference WAV file for zero-shot voice cloning (5–10s recommended)",
    )
    args = parser.parse_args()

    try:
        import torchaudio as ta
        from chatterbox.tts_turbo import ChatterboxTurboTTS
    except ImportError as e:
        print(
            f"ERROR: {e}\n"
            "Chatterbox Turbo is not installed.\n"
            "Install it with:  pip install chatterbox-tts\n"
            "Python 3.11 is strongly recommended.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("Loading Chatterbox Turbo model (first run downloads ~1.5 GB)...", file=sys.stderr)
    model = ChatterboxTurboTTS.from_pretrained(device=args.device)

    generate_kwargs: dict = {"audio_prompt_path": args.audio_prompt} if args.audio_prompt else {}
    wav = model.generate(args.text, **generate_kwargs)

    ta.save(args.out, wav, model.sr)
    print(f"Audio saved to: {args.out}", file=sys.stderr)

    # Chatterbox Turbo does not expose word-level timestamps natively.
    # We approximate by distributing words evenly across the total audio duration.
    # Caption timing will be approximate but functional.
    duration_sec: float = wav.shape[-1] / model.sr
    words = args.text.split()
    if not words:
        timestamps = []
    else:
        step = duration_sec / len(words)
        timestamps = [
            {"word": word, "start": round(i * step, 4), "end": round((i + 1) * step, 4)}
            for i, word in enumerate(words)
        ]

    with open(args.timestamps, "w", encoding="utf-8") as f:
        json.dump(timestamps, f)
    print(f"Timestamps saved to: {args.timestamps}", file=sys.stderr)


if __name__ == "__main__":
    main()

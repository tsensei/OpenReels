import type { WordTimestamp } from "../../schema/providers.js";

// Cloud word-timestamp aligner — interface-compatible with WhisperAligner.
// Uploads the synthesized audio to 60db /stt and returns the word-level
// alignment 60db emits. Useful when running on machines without GPU where
// the local Whisper model would be slow, or when you just don't want the
// ~460 MB Whisper download on first run.
//
// Caveat: 60db /stt is pure transcription, not forced alignment — if the
// transcription drifts from the input text the captions will follow what
// was *heard*, not what was *requested*. For most TTS providers the audio
// matches the input text closely, so this rarely matters in practice.
// Reference: https://docs.60db.ai/api-reference/stt/speech-to-text
const SIXTYDB_BASE = process.env["SIXTYDB_API_BASE"] ?? "https://api.60db.ai";

export class SixtyDbAligner {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env["SIXTYDB_API_KEY"];
    if (!key) {
      throw new Error("SIXTYDB_API_KEY environment variable is required for cloud alignment");
    }
    this.apiKey = key;
  }

  // Match WhisperAligner.align() signature so AlignedTTSProvider can use
  // either interchangeably without changing its constructor type.
  async align(audio: Buffer, _text: string): Promise<WordTimestamp[]> {
    const form = new FormData();
    // 60db /stt accepts mp3/wav/m4a/ogg/flac/webm/mp4 — TTS outputs are
    // always one of these, so we don't need to sniff the container.
    form.append("file", new Blob([new Uint8Array(audio)]), "voiceover.audio");
    form.append("return_timestamps", "word");
    form.append("include_confidence", "false");

    const response = await fetch(`${SIXTYDB_BASE}/stt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`60db /stt ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      text?: string;
      words?: { word: string; start: number; end: number }[];
      segments?: {
        words?: { word: string; start: number; end: number }[];
      }[];
    };

    // 60db emits word timestamps in either a top-level `words` array or
    // nested under per-segment objects. Accept both shapes.
    const flat: WordTimestamp[] = [];
    if (Array.isArray(data.words)) {
      for (const w of data.words) {
        if (w?.word && Number.isFinite(w.start) && Number.isFinite(w.end)) {
          flat.push({ word: w.word, start: w.start, end: w.end });
        }
      }
    }
    if (flat.length === 0 && Array.isArray(data.segments)) {
      for (const seg of data.segments) {
        for (const w of seg.words ?? []) {
          if (w?.word && Number.isFinite(w.start) && Number.isFinite(w.end)) {
            flat.push({ word: w.word, start: w.start, end: w.end });
          }
        }
      }
    }

    if (flat.length === 0) {
      // Same hard-fail policy as WhisperAligner — broken captions are
      // worse than no video.
      throw new Error("60db cloud aligner returned 0 word timestamps");
    }
    return flat;
  }
}

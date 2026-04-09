import wavefile from "wavefile";
import type { WordTimestamp } from "../../schema/providers.js";

type TranscriberPipeline = (
  audio: Float32Array,
  opts: { return_timestamps: "word"; chunk_length_s: number; stride_length_s: number },
) => Promise<{ chunks: { text: string; timestamp: [number, number] }[] }>;

/**
 * Extracts word-level timestamps from audio using Whisper forced alignment.
 *
 * Lazy-loads the Whisper model on first call and caches the pipeline instance.
 * Uses whisper-small.en_timestamped for best accuracy (98.9% coverage in staging tests).
 *
 *   audio (WAV/PCM) ──► resample 16kHz ──► Whisper ASR ──► raw words
 *                                                              │
 *   known transcript ─────────────────────────────────► alignToTranscript()
 *                                                              │
 *                                                        WordTimestamp[]
 */
export class WhisperAligner {
  private static MODEL_ID = "onnx-community/whisper-small.en_timestamped";
  private transcriber: TranscriberPipeline | null = null;
  private loadingPromise: Promise<TranscriberPipeline> | null = null;

  private async getTranscriber(): Promise<TranscriberPipeline> {
    if (this.transcriber) return this.transcriber;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const { pipeline } = await import("@huggingface/transformers");
        const transcriber = await pipeline(
          "automatic-speech-recognition",
          WhisperAligner.MODEL_ID,
        );
        this.transcriber = transcriber as unknown as TranscriberPipeline;
        return this.transcriber;
      } catch (err) {
        this.loadingPromise = null;
        throw new Error(
          `Failed to load Whisper model (${WhisperAligner.MODEL_ID}): ${err instanceof Error ? err.message : String(err)}. ` +
            "Check your network connection. The model (~460MB) downloads from HuggingFace on first run.",
        );
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Align audio to known transcript text, producing word-level timestamps.
   * Throws if Whisper produces 0 usable words (hard fail — broken captions are
   * worse than no video).
   */
  async align(audio: Buffer, text: string): Promise<WordTimestamp[]> {
    const float32 = this.audioToFloat32(audio);
    const transcriber = await this.getTranscriber();

    const result = await transcriber(float32, {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const whisperWords: WordTimestamp[] = (result.chunks ?? []).map((c) => ({
      word: c.text.trim(),
      start: c.timestamp[0],
      end: c.timestamp[1],
    }));

    // Hard fail if Whisper couldn't transcribe anything — interpolated timestamps
    // without any anchor points would produce broken captions.
    if (whisperWords.length === 0 && text.trim().length > 0) {
      throw new Error(
        `Whisper alignment failed: produced 0 words for ${text.split(/\s+/).length}-word transcript. ` +
          "The audio may be corrupt, silent, or in an unsupported format.",
      );
    }

    return this.alignToTranscript(text, whisperWords);
  }

  /**
   * Map Whisper's recognized words to the known transcript using greedy
   * window matching with substring fallback and neighbor interpolation
   * for missed words.
   */
  alignToTranscript(text: string, hyp: WordTimestamp[]): WordTimestamp[] {
    const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
    const refWords = text.split(/\s+/).filter((w) => norm(w).length > 0);
    const result: WordTimestamp[] = [];
    let hi = 0;

    for (const rw of refWords) {
      const nr = norm(rw);
      if (!nr) continue;

      // Greedy search: look ahead up to 5 positions for a match
      let best = -1;
      for (let j = hi; j < Math.min(hi + 5, hyp.length); j++) {
        const nh = norm(hyp[j]!.word);
        if (nr === nh) {
          best = j;
          break;
        }
        if (nr.includes(nh) || nh.includes(nr)) {
          if (best === -1) best = j;
        }
      }

      if (best >= 0) {
        result.push({ word: rw, start: hyp[best]!.start, end: hyp[best]!.end });
        hi = best + 1;
      } else {
        // Interpolate from last known position using character-based duration estimate.
        // ~60ms per character at normal speech pace, with a floor of 100ms.
        const prev = result[result.length - 1];
        const start = prev?.end ?? 0;
        const estimatedDuration = Math.max(0.1, rw.length * 0.06);
        result.push({ word: rw, start, end: start + estimatedDuration });
      }
    }

    return result;
  }

  /**
   * Convert WAV/PCM buffer to 16kHz float32 samples for Whisper.
   * Uses wavefile for format detection and resampling.
   */
  private audioToFloat32(audio: Buffer): Float32Array {
    const wav = new wavefile.WaveFile(audio);

    wav.toBitDepth("32f");
    wav.toSampleRate(16000);

    let samples = wav.getSamples() as Float64Array | Float64Array[];
    if (Array.isArray(samples)) samples = samples[0]!;

    return new Float32Array(samples);
  }
}

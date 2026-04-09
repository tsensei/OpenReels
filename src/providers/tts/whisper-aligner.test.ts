import { describe, expect, it, vi, beforeEach } from "vitest";
import { WhisperAligner } from "./whisper-aligner.js";

// Mock @huggingface/transformers so tests don't download a 460MB model
const mockTranscriber = vi.fn().mockResolvedValue({
  chunks: [
    { text: " Hello", timestamp: [0, 0.3] },
    { text: " world", timestamp: [0.3, 0.6] },
  ],
});

vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn().mockResolvedValue(mockTranscriber),
}));

describe("WhisperAligner", () => {
  let aligner: WhisperAligner;

  beforeEach(() => {
    vi.clearAllMocks();
    aligner = new WhisperAligner();
    // Mock the private audioToFloat32 method to avoid wavefile dependency in tests
    vi.spyOn(aligner as never, "audioToFloat32" as never).mockReturnValue(
      new Float32Array([0.1, 0.2, 0.3]) as never,
    );
  });

  describe("alignToTranscript", () => {
    it("maps exact word matches to Whisper timestamps", () => {
      const hyp = [
        { word: "Hello", start: 0, end: 0.3 },
        { word: "world", start: 0.3, end: 0.6 },
      ];
      const result = aligner.alignToTranscript("Hello world", hyp);
      expect(result).toEqual([
        { word: "Hello", start: 0, end: 0.3 },
        { word: "world", start: 0.3, end: 0.6 },
      ]);
    });

    it("handles substring matches (Whisper splits compound words)", () => {
      const hyp = [
        { word: "twenty", start: 0, end: 0.3 },
        { word: "five", start: 0.3, end: 0.5 },
        { word: "dollars", start: 0.5, end: 0.8 },
      ];
      const result = aligner.alignToTranscript("twenty-five dollars", hyp);
      expect(result).toHaveLength(2);
      expect(result[0]!.word).toBe("twenty-five");
      expect(result[1]!.word).toBe("dollars");
    });

    it("interpolates timestamps for missed words", () => {
      const hyp = [
        { word: "Hello", start: 0, end: 0.3 },
        { word: "world", start: 0.5, end: 0.8 },
      ];
      const result = aligner.alignToTranscript("Hello beautiful world", hyp);
      expect(result).toHaveLength(3);
      expect(result[0]!.word).toBe("Hello");
      expect(result[1]!.word).toBe("beautiful");
      expect(result[1]!.start).toBe(0.3); // starts at end of previous
      expect(result[2]!.word).toBe("world");
    });

    it("interpolates first word if missed", () => {
      const hyp = [{ word: "world", start: 0.3, end: 0.6 }];
      const result = aligner.alignToTranscript("Hello world", hyp);
      expect(result).toHaveLength(2);
      expect(result[0]!.word).toBe("Hello");
      expect(result[0]!.start).toBe(0);
      expect(result[1]!.word).toBe("world");
    });

    it("handles consecutive missed words with character-based durations", () => {
      const hyp = [
        { word: "Hello", start: 0, end: 0.3 },
        { word: "end", start: 1.0, end: 1.3 },
      ];
      const result = aligner.alignToTranscript("Hello missed both end", hyp);
      expect(result).toHaveLength(4);
      expect(result[1]!.word).toBe("missed");
      expect(result[2]!.word).toBe("both");
      // Character-based: "missed" = 6 chars * 0.06 = 0.36s
      expect(result[1]!.start).toBe(0.3);
      expect(result[1]!.end).toBeCloseTo(0.3 + 6 * 0.06, 5);
      // "both" starts where "missed" ends
      expect(result[2]!.start).toBe(result[1]!.end);
    });

    it("uses character-based duration for interpolated words", () => {
      const hyp = [
        { word: "Hello", start: 0, end: 0.3 },
        { word: "world", start: 0.5, end: 0.8 },
      ];
      // "I" is 1 char -> max(0.1, 1*0.06) = 0.1s (floor)
      const result = aligner.alignToTranscript("Hello I world", hyp);
      expect(result[1]!.word).toBe("I");
      expect(result[1]!.end - result[1]!.start).toBeCloseTo(0.1, 5);
    });

    it("scales interpolation with word length", () => {
      const hyp = [
        { word: "The", start: 0, end: 0.2 },
        { word: "end", start: 2.0, end: 2.3 },
      ];
      // "unfortunately" = 13 chars * 0.06 = 0.78s
      const result = aligner.alignToTranscript("The unfortunately end", hyp);
      expect(result[1]!.word).toBe("unfortunately");
      expect(result[1]!.end - result[1]!.start).toBeCloseTo(13 * 0.06, 5);
    });

    it("returns empty array for empty text", () => {
      const result = aligner.alignToTranscript("", []);
      expect(result).toEqual([]);
    });

    it("returns empty array for whitespace-only text", () => {
      const result = aligner.alignToTranscript("   ", []);
      expect(result).toEqual([]);
    });

    it("handles text with punctuation", () => {
      const hyp = [
        { word: "Hello,", start: 0, end: 0.3 },
        { word: "world!", start: 0.3, end: 0.6 },
      ];
      const result = aligner.alignToTranscript("Hello, world!", hyp);
      expect(result).toHaveLength(2);
      expect(result[0]!.word).toBe("Hello,");
      expect(result[1]!.word).toBe("world!");
    });

    it("handles case-insensitive matching", () => {
      const hyp = [
        { word: "HELLO", start: 0, end: 0.3 },
        { word: "WORLD", start: 0.3, end: 0.6 },
      ];
      const result = aligner.alignToTranscript("Hello World", hyp);
      expect(result).toHaveLength(2);
      expect(result[0]!.word).toBe("Hello");
      expect(result[1]!.word).toBe("World");
    });
  });

  describe("align", () => {
    it("calls Whisper and returns aligned timestamps", async () => {
      const audio = Buffer.from("fake audio data");
      const result = await aligner.align(audio, "Hello world");
      expect(result).toHaveLength(2);
      expect(result[0]!.word).toBe("Hello");
      expect(result[1]!.word).toBe("world");
    });

    it("throws on 0 words for non-empty text", async () => {
      mockTranscriber.mockResolvedValueOnce({ chunks: [] });

      const audio = Buffer.from("fake audio data");
      await expect(aligner.align(audio, "Hello world")).rejects.toThrow(
        "Whisper alignment failed: produced 0 words",
      );
    });

    it("passes chunking options to transcriber", async () => {
      const audio = Buffer.from("fake audio data");
      await aligner.align(audio, "Hello world");

      expect(mockTranscriber).toHaveBeenCalledWith(expect.any(Float32Array), {
        return_timestamps: "word",
        chunk_length_s: 30,
        stride_length_s: 5,
      });
    });
  });
});

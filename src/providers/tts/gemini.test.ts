import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { GeminiTTS } from "./gemini.js";

// Mock wavefile
vi.mock("wavefile", () => ({
  WaveFile: vi.fn().mockImplementation(() => ({
    fromScratch: vi.fn(),
    toBuffer: vi.fn().mockReturnValue(Buffer.from("RIFF....WAVEfmt mock wav")),
  })),
}));

// Mock @google/genai
const mockGenerateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

const VALID_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: Buffer.from("RIFF....WAVEfmt fake pcm audio").toString("base64"),
            },
          },
        ],
      },
    },
  ],
};

describe("GeminiTTS", () => {
  const origKey = process.env["GOOGLE_API_KEY"];

  beforeEach(() => {
    process.env["GOOGLE_API_KEY"] = "test-google-key";
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (origKey !== undefined) {
      process.env["GOOGLE_API_KEY"] = origKey;
    } else {
      delete process.env["GOOGLE_API_KEY"];
    }
  });

  describe("constructor", () => {
    it("throws when GOOGLE_API_KEY is not set", () => {
      delete process.env["GOOGLE_API_KEY"];
      expect(() => new GeminiTTS()).toThrow("GOOGLE_API_KEY environment variable is required");
    });

    it("accepts custom model and apiKey", () => {
      const tts = new GeminiTTS("custom-model", "custom-key");
      expect(tts).toBeInstanceOf(GeminiTTS);
    });
  });

  describe("generate", () => {
    it("returns audio buffer with empty words array", async () => {
      mockGenerateContent.mockResolvedValue(VALID_RESPONSE);
      const tts = new GeminiTTS();
      const result = await tts.generate("Hello world");

      expect(Buffer.isBuffer(result.audio)).toBe(true);
      expect(result.words).toEqual([]);
    });

    it("returns WAV audio (RIFF header)", async () => {
      mockGenerateContent.mockResolvedValue(VALID_RESPONSE);
      const tts = new GeminiTTS();
      const result = await tts.generate("Hello world");

      expect(result.audio.toString("ascii", 0, 4)).toBe("RIFF");
    });

    it("wraps rate limit errors", async () => {
      mockGenerateContent.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED"));
      const tts = new GeminiTTS();

      await expect(tts.generate("Hello")).rejects.toThrow("Gemini TTS rate limited");
    });

    it("wraps auth errors", async () => {
      mockGenerateContent.mockRejectedValue(new Error("403 API_KEY_INVALID"));
      const tts = new GeminiTTS();

      await expect(tts.generate("Hello")).rejects.toThrow("Gemini TTS authentication failed");
    });

    it("wraps generic API errors", async () => {
      mockGenerateContent.mockRejectedValue(new Error("500 Internal Server Error"));
      const tts = new GeminiTTS();

      await expect(tts.generate("Hello")).rejects.toThrow("Gemini TTS API error");
    });

    it("throws when response has no audio data", async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [{ content: { parts: [] } }],
      });
      const tts = new GeminiTTS();

      await expect(tts.generate("Hello")).rejects.toThrow("Gemini TTS returned no audio data");
    });

    it("throws when response has no candidates", async () => {
      mockGenerateContent.mockResolvedValue({ candidates: [] });
      const tts = new GeminiTTS();

      await expect(tts.generate("Hello")).rejects.toThrow("Gemini TTS returned no audio data");
    });
  });
});

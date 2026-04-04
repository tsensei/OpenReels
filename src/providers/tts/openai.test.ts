import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { OpenAITTS } from "./openai.js";

// Mock openai SDK
const mockSpeechCreate = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: { speech: { create: mockSpeechCreate } },
  })),
}));

const VALID_RESPONSE = {
  arrayBuffer: vi.fn().mockResolvedValue(
    new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00]).buffer,
  ),
};

describe("OpenAITTS", () => {
  const origKey = process.env["OPENAI_API_KEY"];

  beforeEach(() => {
    process.env["OPENAI_API_KEY"] = "test-openai-key";
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (origKey !== undefined) {
      process.env["OPENAI_API_KEY"] = origKey;
    } else {
      delete process.env["OPENAI_API_KEY"];
    }
  });

  describe("constructor", () => {
    it("throws when OPENAI_API_KEY is not set", () => {
      delete process.env["OPENAI_API_KEY"];
      expect(() => new OpenAITTS()).toThrow("OPENAI_API_KEY environment variable is required");
    });

    it("accepts custom model and apiKey", () => {
      const tts = new OpenAITTS("tts-1-hd", "custom-key");
      expect(tts).toBeInstanceOf(OpenAITTS);
    });
  });

  describe("generate", () => {
    it("returns audio buffer with empty words array", async () => {
      mockSpeechCreate.mockResolvedValue(VALID_RESPONSE);
      const tts = new OpenAITTS();
      const result = await tts.generate("Hello world");

      expect(Buffer.isBuffer(result.audio)).toBe(true);
      expect(result.audio.length).toBeGreaterThan(0);
      expect(result.words).toEqual([]);
    });

    it("calls speech API with correct parameters", async () => {
      mockSpeechCreate.mockResolvedValue(VALID_RESPONSE);
      const tts = new OpenAITTS();
      await tts.generate("Hello world");

      expect(mockSpeechCreate).toHaveBeenCalledWith({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: "Hello world",
        response_format: "wav",
      });
    });

    it("wraps rate limit errors", async () => {
      mockSpeechCreate.mockRejectedValue(new Error("429 rate_limit_exceeded"));
      const tts = new OpenAITTS();

      await expect(tts.generate("Hello")).rejects.toThrow("OpenAI TTS rate limited");
    });

    it("wraps auth errors", async () => {
      mockSpeechCreate.mockRejectedValue(new Error("401 invalid_api_key"));
      const tts = new OpenAITTS();

      await expect(tts.generate("Hello")).rejects.toThrow("OpenAI TTS authentication failed");
    });

    it("wraps generic API errors", async () => {
      mockSpeechCreate.mockRejectedValue(new Error("500 Internal Server Error"));
      const tts = new OpenAITTS();

      await expect(tts.generate("Hello")).rejects.toThrow("OpenAI TTS API error");
    });

    it("throws when response has no audio data", async () => {
      mockSpeechCreate.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      });
      const tts = new OpenAITTS();

      await expect(tts.generate("Hello")).rejects.toThrow("OpenAI TTS returned no audio data");
    });

    it("uses custom model when provided", async () => {
      mockSpeechCreate.mockResolvedValue(VALID_RESPONSE);
      const tts = new OpenAITTS("tts-1-hd");
      await tts.generate("Hello");

      expect(mockSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "tts-1-hd" }),
      );
    });
  });
});

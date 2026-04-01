import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InworldTTS } from "./inworld.js";

const VALID_RESPONSE = {
  audioContent: Buffer.from("fake-mp3-audio").toString("base64"),
  usage: { processedCharactersCount: 12, modelId: "inworld-tts-1.5-max" },
  timestampInfo: {
    wordAlignment: {
      words: ["Hello,", "world"],
      wordStartTimeSeconds: [0, 0.28],
      wordEndTimeSeconds: [0.28, 0.8],
    },
  },
};

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe("InworldTTS", () => {
  const originalEnv = process.env["INWORLD_TTS_API_KEY"];

  beforeEach(() => {
    process.env["INWORLD_TTS_API_KEY"] = "test-api-key";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["INWORLD_TTS_API_KEY"] = originalEnv;
    } else {
      delete process.env["INWORLD_TTS_API_KEY"];
    }
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("throws when INWORLD_TTS_API_KEY is not set", () => {
      delete process.env["INWORLD_TTS_API_KEY"];
      expect(() => new InworldTTS()).toThrow(
        "INWORLD_TTS_API_KEY environment variable is required",
      );
    });

    it("uses default voiceId and modelId when none provided", () => {
      const tts = new InworldTTS();
      // Verify it constructs without error — defaults are internal
      expect(tts).toBeInstanceOf(InworldTTS);
    });

    it("accepts custom voiceId and modelId", () => {
      const tts = new InworldTTS("CustomVoice", "inworld-tts-1.5-mini");
      expect(tts).toBeInstanceOf(InworldTTS);
    });
  });

  describe("generate", () => {
    it("maps parallel arrays to WordTimestamp[] correctly", async () => {
      vi.stubGlobal("fetch", mockFetchResponse(VALID_RESPONSE));
      const tts = new InworldTTS();
      const result = await tts.generate("Hello, world");

      expect(result.words).toEqual([
        { word: "Hello,", start: 0, end: 0.28 },
        { word: "world", start: 0.28, end: 0.8 },
      ]);
    });

    it("decodes base64 audio to Buffer", async () => {
      vi.stubGlobal("fetch", mockFetchResponse(VALID_RESPONSE));
      const tts = new InworldTTS();
      const result = await tts.generate("Hello, world");

      expect(Buffer.isBuffer(result.audio)).toBe(true);
      expect(result.audio.toString()).toBe("fake-mp3-audio");
    });

    it("handles single word input", async () => {
      const singleWordResponse = {
        audioContent: Buffer.from("audio").toString("base64"),
        timestampInfo: {
          wordAlignment: {
            words: ["Hello"],
            wordStartTimeSeconds: [0],
            wordEndTimeSeconds: [0.5],
          },
        },
      };
      vi.stubGlobal("fetch", mockFetchResponse(singleWordResponse));
      const tts = new InworldTTS();
      const result = await tts.generate("Hello");

      expect(result.words).toHaveLength(1);
      expect(result.words[0]).toEqual({ word: "Hello", start: 0, end: 0.5 });
    });

    it("preserves punctuation on words", async () => {
      const punctuationResponse = {
        audioContent: Buffer.from("audio").toString("base64"),
        timestampInfo: {
          wordAlignment: {
            words: ["Hello,", "world!", "How's", "it?"],
            wordStartTimeSeconds: [0, 0.3, 0.6, 0.9],
            wordEndTimeSeconds: [0.3, 0.6, 0.9, 1.2],
          },
        },
      };
      vi.stubGlobal("fetch", mockFetchResponse(punctuationResponse));
      const tts = new InworldTTS();
      const result = await tts.generate("Hello, world! How's it?");

      expect(result.words.map((w) => w.word)).toEqual(["Hello,", "world!", "How's", "it?"]);
    });

    it("handles empty word arrays", async () => {
      const emptyResponse = {
        audioContent: Buffer.from("silence").toString("base64"),
        timestampInfo: {
          wordAlignment: {
            words: [],
            wordStartTimeSeconds: [],
            wordEndTimeSeconds: [],
          },
        },
      };
      vi.stubGlobal("fetch", mockFetchResponse(emptyResponse));
      const tts = new InworldTTS();
      const result = await tts.generate(" ");

      expect(result.words).toEqual([]);
      expect(Buffer.isBuffer(result.audio)).toBe(true);
    });

    it("sends correct request body", async () => {
      const fetchMock = mockFetchResponse(VALID_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);
      const tts = new InworldTTS("TestVoice", "inworld-tts-1.5-mini");
      await tts.generate("Test text");

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.inworld.ai/tts/v1/voice");
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({
        Authorization: "Basic test-api-key",
        "Content-Type": "application/json",
      });
      const body = JSON.parse(options.body as string);
      expect(body.voiceId).toBe("TestVoice");
      expect(body.modelId).toBe("inworld-tts-1.5-mini");
      expect(body.timestampType).toBe("WORD");
      expect(body.audioConfig.audioEncoding).toBe("MP3");
    });
  });

  describe("generate error paths", () => {
    it("throws when text exceeds 2000 characters", async () => {
      const tts = new InworldTTS();
      const longText = "a".repeat(2001);

      await expect(tts.generate(longText)).rejects.toThrow(
        "Inworld TTS limit exceeded: script is 2001 chars, max 2000",
      );
    });

    it("throws on non-200 API response", async () => {
      vi.stubGlobal("fetch", mockFetchResponse({ error: "rate limited" }, 429));
      const tts = new InworldTTS();

      await expect(tts.generate("Hello")).rejects.toThrow("Inworld TTS API error (429)");
    });

    it("throws when response is missing audioContent", async () => {
      const noAudio = { timestampInfo: VALID_RESPONSE.timestampInfo };
      vi.stubGlobal("fetch", mockFetchResponse(noAudio));
      const tts = new InworldTTS();

      await expect(tts.generate("Hello")).rejects.toThrow(
        "Inworld TTS response missing audioContent",
      );
    });

    it("throws when response is missing timestampInfo", async () => {
      const noTimestamps = { audioContent: VALID_RESPONSE.audioContent };
      vi.stubGlobal("fetch", mockFetchResponse(noTimestamps));
      const tts = new InworldTTS();

      await expect(tts.generate("Hello")).rejects.toThrow(
        "Inworld TTS response missing timestamp info",
      );
    });

    it("throws when response has missing wordAlignment", async () => {
      const noAlignment = { audioContent: VALID_RESPONSE.audioContent, timestampInfo: {} };
      vi.stubGlobal("fetch", mockFetchResponse(noAlignment));
      const tts = new InworldTTS();

      await expect(tts.generate("Hello")).rejects.toThrow(
        "Inworld TTS response missing timestamp info",
      );
    });

    it("throws when timestamp arrays have mismatched lengths", async () => {
      const mismatch = {
        audioContent: VALID_RESPONSE.audioContent,
        timestampInfo: {
          wordAlignment: {
            words: ["Hello", "world"],
            wordStartTimeSeconds: [0],
            wordEndTimeSeconds: [0.3, 0.6],
          },
        },
      };
      vi.stubGlobal("fetch", mockFetchResponse(mismatch));
      const tts = new InworldTTS();

      await expect(tts.generate("Hello world")).rejects.toThrow("timestamp array length mismatch");
    });
  });
});

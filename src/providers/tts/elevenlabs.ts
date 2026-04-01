import type { TTSProvider, TTSResult, WordTimestamp } from "../../schema/providers.js";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export class ElevenLabsTTS implements TTSProvider {
  private apiKey: string;
  private voiceId: string;

  constructor(voiceId: string = "yl2ZDV1MzN4HbQJbMihG", apiKey?: string) {
    const key = apiKey ?? process.env["ELEVENLABS_API_KEY"];
    if (!key) throw new Error("ELEVENLABS_API_KEY environment variable is required");
    this.apiKey = key;
    this.voiceId = voiceId;
  }

  async generate(text: string): Promise<TTSResult> {
    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${this.voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ElevenLabsTimestampResponse;

    // Decode base64 audio
    const audioBuffer = Buffer.from(data.audio_base64, "base64");

    // Aggregate character timestamps into word timestamps
    const words = this.aggregateCharactersToWords(
      text,
      data.alignment.characters,
      data.alignment.character_start_times_seconds,
      data.alignment.character_end_times_seconds,
    );

    return { audio: audioBuffer, words };
  }

  private aggregateCharactersToWords(
    _originalText: string,
    characters: string[],
    starts: number[],
    ends: number[],
  ): WordTimestamp[] {
    const words: WordTimestamp[] = [];
    let currentWord = "";
    let wordStart = -1;
    let wordEnd = -1;

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i] ?? "";
      const start = starts[i] ?? 0;
      const end = ends[i] ?? 0;

      if (char === " " || char === "\n" || char === "\t") {
        // Whitespace = word boundary
        if (currentWord.length > 0 && wordStart >= 0) {
          words.push({ word: currentWord, start: wordStart, end: wordEnd });
        }
        currentWord = "";
        wordStart = -1;
        wordEnd = -1;
      } else {
        if (wordStart < 0) {
          wordStart = start;
        }
        wordEnd = end;
        currentWord += char;
      }
    }

    // Push last word
    if (currentWord.length > 0 && wordStart >= 0) {
      words.push({ word: currentWord, start: wordStart, end: wordEnd });
    }

    return words;
  }
}

interface ElevenLabsTimestampResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

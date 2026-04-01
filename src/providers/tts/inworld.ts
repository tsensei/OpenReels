import type { TTSProvider, TTSResult, WordTimestamp } from "../../schema/providers.js";

const INWORLD_BASE = "https://api.inworld.ai/tts/v1";
const MAX_INPUT_CHARS = 2000;

export class InworldTTS implements TTSProvider {
  private apiKey: string;
  private voiceId: string;
  private modelId: string;

  constructor(
    voiceId: string = "Dennis",
    modelId: string = "inworld-tts-1.5-max",
    apiKey?: string,
  ) {
    const key = apiKey ?? process.env["INWORLD_TTS_API_KEY"];
    if (!key) throw new Error("INWORLD_TTS_API_KEY environment variable is required");
    this.apiKey = key;
    this.voiceId = voiceId;
    this.modelId = modelId;
  }

  async generate(text: string): Promise<TTSResult> {
    if (text.length > MAX_INPUT_CHARS) {
      throw new Error(
        `Inworld TTS limit exceeded: script is ${text.length} chars, max ${MAX_INPUT_CHARS}. Shorten the script or use a different TTS provider.`,
      );
    }

    const response = await fetch(`${INWORLD_BASE}/voice`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voiceId: this.voiceId,
        modelId: this.modelId,
        audioConfig: {
          audioEncoding: "MP3",
        },
        timestampType: "WORD",
        applyTextNormalization: "ON",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Inworld TTS API error (${response.status}): ${errorText}`);
    }

    const responseText = await response.text();
    let data: InworldTTSResponse;
    try {
      data = JSON.parse(responseText) as InworldTTSResponse;
    } catch {
      throw new Error(`Inworld TTS returned invalid JSON: ${responseText.slice(0, 200)}`);
    }

    // Validate response shape
    if (!data.audioContent) {
      throw new Error("Inworld TTS response missing audioContent");
    }
    if (!data.timestampInfo?.wordAlignment) {
      throw new Error("Inworld TTS response missing timestamp info");
    }

    const { words, wordStartTimeSeconds, wordEndTimeSeconds } = data.timestampInfo.wordAlignment;

    if (
      words.length !== wordStartTimeSeconds.length ||
      words.length !== wordEndTimeSeconds.length
    ) {
      throw new Error(
        `Inworld TTS timestamp array length mismatch: words=${words.length}, starts=${wordStartTimeSeconds.length}, ends=${wordEndTimeSeconds.length}`,
      );
    }

    // Map parallel arrays to WordTimestamp[]
    const timestamps: WordTimestamp[] = words.map((word, i) => ({
      word,
      start: wordStartTimeSeconds[i] ?? 0,
      end: wordEndTimeSeconds[i] ?? 0,
    }));

    const audioBuffer = Buffer.from(data.audioContent, "base64");

    return { audio: audioBuffer, words: timestamps };
  }
}

interface InworldTTSResponse {
  audioContent: string;
  usage?: {
    processedCharactersCount: number;
    modelId: string;
  };
  timestampInfo?: {
    wordAlignment: {
      words: string[];
      wordStartTimeSeconds: number[];
      wordEndTimeSeconds: number[];
      phoneticDetails?: unknown[];
    };
  };
}

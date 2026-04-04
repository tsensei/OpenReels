import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { MusicMood } from "../../schema/director-score.js";
import type { MusicProvider, MusicResult } from "../../schema/providers.js";

const MODEL = "lyria-3-pro-preview";
const MAX_RETRIES = 1;

/**
 * AI music generation via Google Lyria 3 Pro.
 * Uses the standard Gemini generateContent API with audio response modality.
 *
 *   prompt ──▶ Lyria API ──▶ base64 audio ──▶ temp MP3 file
 *                  │
 *                  ├── success ──▶ return { filePath, metadata }
 *                  ├── safety filter ──▶ sanitize prompt ──▶ retry once
 *                  └── other error ──▶ throw
 */
export class LyriaMusic implements MusicProvider {
  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env["GOOGLE_API_KEY"];
    if (!key) throw new Error("GOOGLE_API_KEY is required for Lyria music generation");
    this.client = new GoogleGenAI({ apiKey: key });
  }

  async generate(prompt: string, _mood: MusicMood): Promise<MusicResult> {
    let lastError: Error | null = null;
    let currentPrompt = prompt;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.callLyria(currentPrompt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // On safety filter rejection, retry with sanitized prompt
        if (attempt < MAX_RETRIES && isSafetyFilterError(lastError)) {
          console.warn(`[lyria] Safety filter triggered, retrying with sanitized prompt`);
          currentPrompt = sanitizePrompt(prompt);
          continue;
        }

        // Non-safety errors: don't retry
        break;
      }
    }

    throw lastError ?? new Error("Lyria music generation failed");
  }

  private async callLyria(prompt: string): Promise<MusicResult> {
    const response = await this.client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseModalities: ["audio", "text"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error("Lyria returned no content");
    }

    // Extract audio and text metadata from response parts
    let audioData: string | null = null;
    let audioMimeType = "audio/mp3";
    const textParts: string[] = [];

    for (const part of parts) {
      if (part.inlineData?.data) {
        audioData = part.inlineData.data;
        if (part.inlineData.mimeType) {
          audioMimeType = part.inlineData.mimeType;
        }
      }
      if (part.text) {
        textParts.push(part.text);
      }
    }

    if (!audioData) {
      throw new Error("Lyria returned no audio data");
    }

    // Verify expected format (Lyria defaults to MP3)
    if (!audioMimeType.includes("mp3") && !audioMimeType.includes("mpeg")) {
      console.warn(`[lyria] Unexpected audio format: ${audioMimeType} (expected audio/mp3)`);
    }

    const buffer = Buffer.from(audioData, "base64");
    const ext = audioMimeType.includes("wav") ? "wav" : "mp3";
    const tmpPath = path.join(os.tmpdir(), `openreels-lyria-${Date.now()}.${ext}`);
    await fsp.writeFile(tmpPath, buffer);

    // Parse metadata from Lyria's text response (section descriptions, BPM, etc.)
    const metadata: Record<string, unknown> = {};
    if (textParts.length > 0) {
      metadata.lyriaResponse = textParts.join("\n");
    }

    return { filePath: tmpPath, metadata };
  }
}

/** Check if an error is a safety filter rejection */
function isSafetyFilterError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes("safety") ||
    msg.includes("blocked") ||
    msg.includes("harm") ||
    msg.includes("policy")
  );
}

/**
 * Strip intense adjectives and potentially triggering descriptors from the prompt
 * while preserving musical structure (instruments, tempo, sections, constraints).
 */
function sanitizePrompt(prompt: string): string {
  const intensifiers = [
    "oppressive",
    "aggressive",
    "violent",
    "brutal",
    "menacing",
    "threatening",
    "dark",
    "sinister",
    "ominous",
    "heavy",
    "intense",
    "fierce",
    "savage",
    "relentless",
    "devastating",
    "explosive",
    "dangerous",
    "deadly",
  ];

  let sanitized = prompt;
  for (const word of intensifiers) {
    sanitized = sanitized.replace(new RegExp(`\\b${word}\\b`, "gi"), "restrained");
  }

  return sanitized;
}

export { sanitizePrompt as _sanitizePrompt };

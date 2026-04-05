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

  // mood is already baked into the LLM-generated prompt; Lyria uses the prompt text directly
  async generate(prompt: string, _mood: MusicMood): Promise<MusicResult> {
    let lastError: Error | null = null;
    let currentPrompt = prompt;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.callLyria(currentPrompt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // finishReason: OTHER is an opaque catch-all from the Gemini API.
        // Don't retry — we can't determine the cause, and adjective sanitization
        // is unlikely to help (the prompt may be perfectly clean).
        if (isFinishReasonOther(lastError)) {
          break;
        }

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

    // Check prompt-level blocking first
    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Lyria prompt blocked: ${blockReason}`);
    }

    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;

    const parts = candidate?.content?.parts;
    if (!parts || parts.length === 0) {
      if (finishReason === "OTHER") {
        // finishReason: OTHER from the Gemini API is an opaque catch-all.
        // Google documents it as "unknown reason." In practice it can mean:
        //   - Non-configurable content filter (PII, artist names, sensitive content)
        //   - Transient model capacity/load issue on the preview service
        //   - Prompt structure the model couldn't process
        // We can't distinguish these cases from the API response alone.
        // See: https://discuss.ai.google.dev/t/gemini-2-5-flash-returning-finishreason-other-and-no-explanation-or-candidates/103858
        throw new Error(
          "Lyria returned empty response (finishReason: OTHER). " +
          "This can be a transient issue with the preview API or a non-configurable " +
          "content filter. Check the rejected prompt in the logs for content issues.",
        );
      }
      const reason = finishReason ? ` (finishReason: ${finishReason})` : "";
      throw new Error(`Lyria returned no content${reason}`);
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

/** Check if the error is a finishReason: OTHER response from the Gemini API.
 *  This is an opaque catch-all. Retrying with adjective sanitization won't help
 *  because we don't know the actual cause. */
function isFinishReasonOther(err: Error): boolean {
  return err.message.includes("finishReason: OTHER");
}

/** Check if an error is a safety filter rejection (not rate limits or network) */
function isSafetyFilterError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes("safety") ||
    msg.includes("harm") ||
    msg.includes("content policy") ||
    msg.includes("blocklist") ||
    msg.includes("prohibited") ||
    (msg.includes("blocked") && (msg.includes("safety") || msg.includes("harm") || msg.includes("content")))
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

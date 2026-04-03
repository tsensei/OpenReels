import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { LLMUsage } from "../../schema/providers.js";

const VerificationSchema = z.object({
  relevant: z.boolean(),
  confidence: z.number(),
  reason: z.string(),
});

export interface VerificationResult {
  relevant: boolean;
  confidence: number;
  reason: string;
  usage: LLMUsage;
}

const SYSTEM_PROMPT = `You are a visual content judge. Given an image and a description of what was requested, determine if the image matches the request.

Be strict:
- A toy rocket does NOT match "rocket launch"
- A generic sunset does NOT match "Mars surface"
- A cartoon illustration does NOT match a request for real footage
- A loosely related image is NOT a match (e.g., "laboratory" for "DNA helix")

Judge the SEMANTIC match between what was requested and what the image actually shows. Ignore aesthetic quality.

Output your confidence as a number between 0 and 1:
- 0.0-0.3: Clearly wrong (different subject entirely)
- 0.3-0.6: Loosely related but not what was requested
- 0.6-0.8: Reasonable match, captures the right subject
- 0.8-1.0: Strong match, exactly what was described`;

/** Extract a single frame from a video file for verification */
function extractVideoFrame(videoPath: string): Buffer {
  const tmpFile = path.join(
    os.tmpdir(),
    `openreels-verify-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
  );
  try {
    // Try 1-second mark first, fall back to 0s for very short clips
    try {
      execFileSync("ffmpeg", [
        "-i", videoPath, "-ss", "1", "-frames:v", "1",
        "-update", "1", "-y", tmpFile,
      ], { stdio: "pipe", timeout: 15_000 });
    } catch {
      execFileSync("ffmpeg", [
        "-i", videoPath, "-ss", "0", "-frames:v", "1",
        "-update", "1", "-y", tmpFile,
      ], { stdio: "pipe", timeout: 15_000 });
    }
    return fs.readFileSync(tmpFile);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore cleanup error */ }
  }
}

export async function verifyStockResult(
  model: LanguageModel,
  assetPath: string,
  visualPrompt: string,
  scriptLine: string,
  confidenceThreshold: number,
): Promise<VerificationResult> {
  try {
    const isVideo = assetPath.endsWith(".mp4");
    const imageBuffer = isVideo ? extractVideoFrame(assetPath) : fs.readFileSync(assetPath);

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${SYSTEM_PROMPT}\n\nRequested visual: ${visualPrompt}\nNarration context: ${scriptLine}\n\nDoes this image match what was requested?`,
            },
            {
              type: "image",
              image: imageBuffer,
              mediaType: assetPath.endsWith(".png") ? "image/png" : "image/jpeg",
            },
          ],
        },
      ],
      output: Output.object({ schema: VerificationSchema }),
    });

    const usage: LLMUsage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    };

    if (result.output == null) {
      return { relevant: false, confidence: 0, reason: "VLM returned no output", usage };
    }

    return {
      relevant: result.output.relevant && result.output.confidence >= confidenceThreshold,
      confidence: result.output.confidence,
      reason: result.output.reason,
      usage,
    };
  } catch (err) {
    console.warn(`[stock] Verification failed, using asset unverified: ${err}`);
    return {
      relevant: true, // stock_unverified: use it with warning
      confidence: -1, // sentinel for "unverified"
      reason: `Verification unavailable: ${err}`,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

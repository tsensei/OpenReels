import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createFalClient, type FalClient } from "@fal-ai/client";
import type { VideoProvider, VideoResult } from "../../schema/providers.js";

const DEFAULT_MODEL = "fal-ai/kling-video/v2.1/standard/image-to-video";

export class FalVideo implements VideoProvider {
  private client: FalClient;
  private modelId: string;

  readonly supportedDurations = [5, 10];

  constructor(modelId: string = DEFAULT_MODEL, apiKey?: string) {
    const key = apiKey ?? process.env["FAL_API_KEY"];
    if (!key) throw new Error("FAL_API_KEY environment variable is required for video generation");
    this.client = createFalClient({ credentials: key });
    this.modelId = modelId;
  }

  async generate(opts: {
    sourceImage: Buffer;
    prompt: string;
    durationSeconds?: number;
    aspectRatio?: string;
  }): Promise<VideoResult> {
    const durationSeconds = opts.durationSeconds ?? 5;
    const aspectRatio = opts.aspectRatio ?? "9:16";

    // Upload source image to fal storage
    const imageBlob = new Blob([new Uint8Array(opts.sourceImage)], { type: "image/png" });
    const imageUrl = await this.client.storage.upload(imageBlob);

    // Subscribe handles the queue + polling cycle in one await
    const result = await this.client.subscribe(this.modelId, {
      input: {
        prompt: opts.prompt,
        image_url: imageUrl,
        duration: durationSeconds,
        aspect_ratio: aspectRatio,
      },
      pollInterval: 5_000,
    });

    // Extract the video URL from the result
    const data = result.data as Record<string, unknown>;
    const video = data?.video as Record<string, string> | undefined;
    const videoUrl = video?.url;
    if (!videoUrl) {
      throw new Error("fal.ai returned no video URL in response");
    }

    // Download the video to a temp file
    const tmpPath = path.join(os.tmpdir(), `openreels-fal-${Date.now()}.mp4`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download fal.ai video: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tmpPath, buffer);

    if (fs.statSync(tmpPath).size === 0) {
      throw new Error("fal.ai video download produced empty file");
    }

    return { filePath: tmpPath, durationSeconds };
  }
}

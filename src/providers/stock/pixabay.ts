import * as fs from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { StockAsset, StockCandidate, StockProvider } from "../../schema/providers.js";

const PIXABAY_BASE = "https://pixabay.com/api";

export class PixabayStock implements StockProvider {
  private apiKey: string | null;
  private cacheDir: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env["PIXABAY_API_KEY"] ?? null;
    this.cacheDir = path.join(process.env["HOME"] ?? "/tmp", ".openreels", "cache", "stock");
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  async searchVideo(query: string): Promise<StockCandidate[]> {
    if (!this.apiKey) return [];

    const url = `${PIXABAY_BASE}/videos/?key=${this.apiKey}&q=${encodeURIComponent(query)}&per_page=3`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = (await response.json()) as PixabayVideoResponse;
    return (data.hits ?? []).map((hit) => {
      const videoSource = hit.videos.medium ?? hit.videos.large;
      return {
        url: videoSource?.url ?? "",
        width: videoSource?.width ?? 1280,
        height: videoSource?.height ?? 720,
        duration: hit.duration,
        id: `pixabay-video-${hit.id}`,
      };
    }).filter((c) => c.url !== "");
  }

  async searchImage(query: string): Promise<StockCandidate[]> {
    if (!this.apiKey) return [];

    const url = `${PIXABAY_BASE}/?key=${this.apiKey}&q=${encodeURIComponent(query)}&per_page=3&image_type=photo&orientation=vertical`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = (await response.json()) as PixabayImageResponse;
    return (data.hits ?? []).map((hit) => ({
      url: hit.largeImageURL,
      width: hit.imageWidth,
      height: hit.imageHeight,
      id: `pixabay-image-${hit.id}`,
    }));
  }

  async download(candidate: StockCandidate): Promise<StockAsset> {
    const ext = candidate.duration != null ? "mp4" : "jpg";
    const filename = `${candidate.id}.${ext}`;
    const filePath = await this.downloadToCache(candidate.url, filename);
    return {
      filePath,
      width: candidate.width,
      height: candidate.height,
      duration: candidate.duration,
    };
  }

  private async downloadToCache(url: string, filename: string): Promise<string> {
    const filePath = path.join(this.cacheDir, filename);
    if (fs.existsSync(filePath)) return filePath;

    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download: ${url}`);
    }

    const fileStream = fs.createWriteStream(filePath);
    await pipeline(Readable.fromWeb(response.body as any), fileStream);
    return filePath;
  }
}

interface PixabayVideoResponse {
  hits: {
    id: number;
    duration: number;
    videos: {
      large?: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
    };
  }[];
}

interface PixabayImageResponse {
  hits: {
    id: number;
    imageWidth: number;
    imageHeight: number;
    largeImageURL: string;
  }[];
}

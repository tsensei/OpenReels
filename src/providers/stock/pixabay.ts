import * as fs from "node:fs";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { StockProvider, StockAsset } from "../../schema/providers.js";

const PIXABAY_BASE = "https://pixabay.com/api";

export class PixabayStock implements StockProvider {
  private apiKey: string | null;
  private cacheDir: string;

  constructor() {
    this.apiKey = process.env["PIXABAY_API_KEY"] ?? null;
    this.cacheDir = path.join(
      process.env["HOME"] ?? "/tmp",
      ".openreels",
      "cache",
      "stock",
    );
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  async searchVideo(query: string): Promise<StockAsset | null> {
    if (!this.apiKey) return null;

    const url = `${PIXABAY_BASE}/videos/?key=${this.apiKey}&q=${encodeURIComponent(query)}&per_page=3`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as PixabayVideoResponse;
    if (!data.hits || data.hits.length === 0) return null;

    const hit = data.hits[0];
    if (!hit) return null;

    // Prefer medium (typically ~1280px) over large to avoid huge downloads
    const videoSource = hit.videos.medium ?? hit.videos.large;
    const videoUrl = videoSource?.url;
    if (!videoUrl) return null;

    const filePath = await this.downloadToCache(videoUrl, `pixabay-video-${hit.id}.mp4`);
    return {
      filePath,
      width: videoSource?.width ?? 1280,
      height: videoSource?.height ?? 720,
      duration: hit.duration,
    };
  }

  async searchImage(query: string): Promise<StockAsset | null> {
    if (!this.apiKey) return null;

    const url = `${PIXABAY_BASE}/?key=${this.apiKey}&q=${encodeURIComponent(query)}&per_page=3&image_type=photo&orientation=vertical`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as PixabayImageResponse;
    if (!data.hits || data.hits.length === 0) return null;

    const hit = data.hits[0];
    if (!hit) return null;

    const filePath = await this.downloadToCache(hit.largeImageURL, `pixabay-image-${hit.id}.jpg`);
    return {
      filePath,
      width: hit.imageWidth,
      height: hit.imageHeight,
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

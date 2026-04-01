import * as fs from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { StockAsset, StockProvider } from "../../schema/providers.js";

const PEXELS_BASE = "https://api.pexels.com";

export class PexelsStock implements StockProvider {
  private apiKey: string | null;
  private cacheDir: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env["PEXELS_API_KEY"] ?? null;
    this.cacheDir = path.join(process.env["HOME"] ?? "/tmp", ".openreels", "cache", "stock");
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  async searchVideo(query: string): Promise<StockAsset | null> {
    if (!this.apiKey) return null;

    const url = `${PEXELS_BASE}/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&size=large`;
    const response = await fetch(url, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[stock] Pexels rate limited, skipping video search");
        return null;
      }
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = (await response.json()) as PexelsVideoResponse;
    if (!data.videos || data.videos.length === 0) {
      // Try without orientation filter (landscape fallback)
      return this.searchVideoLandscapeFallback(query);
    }

    const video = data.videos[0];
    if (!video) return null;

    // Pick a video file: at least 720p but no larger than 1080p to avoid 500MB+ downloads
    const videoFile =
      video.video_files
        .filter((f) => (f.width ?? 0) >= 720 && (f.width ?? 0) <= 1920)
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ??
      // Fallback: if nothing in the 720-1080 range, take the smallest >= 720
      video.video_files
        .filter((f) => (f.width ?? 0) >= 720)
        .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];

    if (!videoFile?.link) return null;

    const filePath = await this.downloadToCache(videoFile.link, `video-${video.id}.mp4`);

    return {
      filePath,
      width: videoFile.width ?? 1080,
      height: videoFile.height ?? 1920,
      duration: video.duration,
    };
  }

  private async searchVideoLandscapeFallback(query: string): Promise<StockAsset | null> {
    if (!this.apiKey) return null;

    const url = `${PEXELS_BASE}/videos/search?query=${encodeURIComponent(query)}&per_page=3&size=large`;
    const response = await fetch(url, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) return null;
    const data = (await response.json()) as PexelsVideoResponse;
    if (!data.videos || data.videos.length === 0) return null;

    const video = data.videos[0];
    if (!video) return null;

    const videoFile =
      video.video_files
        .filter((f) => (f.width ?? 0) >= 720 && (f.width ?? 0) <= 1920)
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ??
      video.video_files
        .filter((f) => (f.width ?? 0) >= 720)
        .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];

    if (!videoFile?.link) return null;

    const filePath = await this.downloadToCache(videoFile.link, `video-${video.id}.mp4`);
    return {
      filePath,
      width: videoFile.width ?? 1920,
      height: videoFile.height ?? 1080,
      duration: video.duration,
    };
  }

  async searchImage(query: string): Promise<StockAsset | null> {
    if (!this.apiKey) return null;

    const url = `${PEXELS_BASE}/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&size=large`;
    const response = await fetch(url, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[stock] Pexels rate limited, skipping image search");
        return null;
      }
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = (await response.json()) as PexelsImageResponse;
    if (!data.photos || data.photos.length === 0) return null;

    const photo = data.photos[0];
    if (!photo) return null;

    const imageUrl = photo.src.large2x ?? photo.src.large ?? photo.src.original;
    const filePath = await this.downloadToCache(imageUrl, `image-${photo.id}.jpg`);

    return {
      filePath,
      width: photo.width,
      height: photo.height,
    };
  }

  private async downloadToCache(url: string, filename: string): Promise<string> {
    const filePath = path.join(this.cacheDir, filename);

    // Return cached if exists
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

interface PexelsVideoResponse {
  videos: {
    id: number;
    duration: number;
    video_files: {
      link: string;
      width?: number;
      height?: number;
      quality?: string;
    }[];
  }[];
}

interface PexelsImageResponse {
  photos: {
    id: number;
    width: number;
    height: number;
    src: {
      original: string;
      large2x: string;
      large: string;
    };
  }[];
}

import * as fs from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { StockAsset, StockCandidate, StockProvider } from "../../schema/providers.js";

const PEXELS_BASE = "https://api.pexels.com";

export class PexelsStock implements StockProvider {
  private apiKey: string | null;
  private cacheDir: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env["PEXELS_API_KEY"] ?? null;
    this.cacheDir = path.join(process.env["HOME"] ?? "/tmp", ".openreels", "cache", "stock");
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  async searchVideo(query: string): Promise<StockCandidate[]> {
    if (!this.apiKey) return [];

    const url = `${PEXELS_BASE}/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&size=large`;
    const response = await fetch(url, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[stock] Pexels rate limited, skipping video search");
        return [];
      }
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = (await response.json()) as PexelsVideoResponse;
    let videos = data.videos ?? [];

    // Try without orientation filter if no portrait results
    if (videos.length === 0) {
      const fallback = await this.searchVideoLandscapeFallback(query);
      if (fallback.length > 0) return fallback;
    }

    const candidates: StockCandidate[] = [];
    for (const video of videos) {
      const videoFile = this.pickVideoFile(video.video_files);
      if (!videoFile?.link) continue;
      candidates.push({
        url: videoFile.link,
        width: videoFile.width ?? 1080,
        height: videoFile.height ?? 1920,
        duration: video.duration,
        id: `pexels-video-${video.id}`,
      });
    }
    return candidates;
  }

  private async searchVideoLandscapeFallback(query: string): Promise<StockCandidate[]> {
    if (!this.apiKey) return [];

    const url = `${PEXELS_BASE}/videos/search?query=${encodeURIComponent(query)}&per_page=3&size=large`;
    const response = await fetch(url, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) return [];
    const data = (await response.json()) as PexelsVideoResponse;
    const videos = data.videos ?? [];

    const candidates: StockCandidate[] = [];
    for (const video of videos) {
      const videoFile = this.pickVideoFile(video.video_files);
      if (!videoFile?.link) continue;
      candidates.push({
        url: videoFile.link,
        width: videoFile.width ?? 1920,
        height: videoFile.height ?? 1080,
        duration: video.duration,
        id: `pexels-video-${video.id}`,
      });
    }
    return candidates;
  }

  private pickVideoFile(files: PexelsVideoResponse["videos"][number]["video_files"]) {
    return (
      files
        .filter((f) => (f.width ?? 0) >= 720 && (f.width ?? 0) <= 1920)
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ??
      files
        .filter((f) => (f.width ?? 0) >= 720)
        .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]
    );
  }

  async searchImage(query: string): Promise<StockCandidate[]> {
    if (!this.apiKey) return [];

    const url = `${PEXELS_BASE}/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&size=large`;
    const response = await fetch(url, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[stock] Pexels rate limited, skipping image search");
        return [];
      }
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = (await response.json()) as PexelsImageResponse;
    return (data.photos ?? []).map((photo) => ({
      url: photo.src.large2x ?? photo.src.large ?? photo.src.original,
      width: photo.width,
      height: photo.height,
      id: `pexels-image-${photo.id}`,
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

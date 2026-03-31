export interface PlatformConfig {
  width: number;
  height: number;
  fps: number;
  maxDurationSeconds: number;
  codec: "h264" | "h265";
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  youtube: { width: 1080, height: 1920, fps: 30, maxDurationSeconds: 60, codec: "h264" },
  tiktok: { width: 1080, height: 1920, fps: 30, maxDurationSeconds: 180, codec: "h264" },
  instagram: { width: 1080, height: 1920, fps: 30, maxDurationSeconds: 90, codec: "h264" },
};

export function getPlatformConfig(platform: string): PlatformConfig {
  const config = PLATFORMS[platform];
  if (!config) {
    throw new Error(`Unknown platform: ${platform}. Available: ${Object.keys(PLATFORMS).join(", ")}`);
  }
  return config;
}

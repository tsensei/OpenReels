import type { DirectorScoreScene } from "@/hooks/useApi";

/** Tracks scenes where stock/video assets fell back to AI generation. */
export type SceneFallbacks = Record<number, "ai_image" | "ai_video_to_image">;

/**
 * Construct the URL for a scene's visual asset.
 * Returns null for text_card scenes (no asset file).
 *
 * When a stock scene falls back to AI image during pipeline execution,
 * the file is saved as scene-{i}-ai.png instead of scene-{i}-stock.jpg.
 * Pass `fallbacks` so the URL points to the actual file on disk.
 */
export function getSceneAssetUrl(
  jobId: string,
  runDir: string,
  scene: DirectorScoreScene,
  index: number,
  fallbacks?: SceneFallbacks,
): string | null {
  const base = `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets`;
  const fb = fallbacks?.[index];

  // Stock scenes that fell back to AI image
  if (fb === "ai_image") {
    return `${base}/scene-${index}-ai.png`;
  }
  // AI video scenes that fell back to the Phase 1 image
  if (fb === "ai_video_to_image") {
    return `${base}/scene-${index}-ai.png`;
  }

  switch (scene.visual_type) {
    case "ai_image":
      return `${base}/scene-${index}-ai.png`;
    case "ai_video":
      return `${base}/scene-${index}-ai-video.mp4`;
    case "stock_image":
      return `${base}/scene-${index}-stock.jpg`;
    case "stock_video":
      return `${base}/scene-${index}-stock.mp4`;
    case "text_card":
      return null;
  }
}

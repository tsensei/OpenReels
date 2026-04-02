import type { DirectorScoreScene } from "@/hooks/useApi";

/**
 * Construct the URL for a scene's visual asset.
 * Returns null for text_card scenes (no asset file).
 * Note: The URL may 404 if the asset failed during generation.
 * Use <img onError> fallback in the UI.
 */
export function getSceneAssetUrl(
  jobId: string,
  runDir: string,
  scene: DirectorScoreScene,
  index: number,
): string | null {
  const base = `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets`;
  switch (scene.visual_type) {
    case "ai_image":
      return `${base}/scene-${index}-ai.png`;
    case "stock_image":
      return `${base}/scene-${index}-stock.jpg`;
    case "stock_video":
      return `${base}/scene-${index}-stock.mp4`;
    case "text_card":
      return null;
  }
}

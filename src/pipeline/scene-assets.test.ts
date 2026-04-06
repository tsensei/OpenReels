import { describe, expect, it } from "vitest";

// Inline type to avoid web path alias dependency in root vitest config
interface DirectorScoreScene {
  visual_type: "ai_image" | "ai_video" | "stock_image" | "stock_video" | "text_card";
  visual_prompt: string;
  motion: string;
  script_line: string;
  transition?: string;
}

type SceneFallbacks = Record<number, "ai_image" | "ai_video_to_image">;

// Inline the function to test (same logic as web/src/lib/scene-assets.ts)
function getSceneAssetUrl(
  jobId: string,
  runDir: string,
  scene: DirectorScoreScene,
  index: number,
  fallbacks?: SceneFallbacks,
): string | null {
  const base = `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets`;
  const fb = fallbacks?.[index];
  if (fb === "ai_image") return `${base}/scene-${index}-ai.png`;
  if (fb === "ai_video_to_image") return `${base}/scene-${index}-ai.png`;
  switch (scene.visual_type) {
    case "ai_image": return `${base}/scene-${index}-ai.png`;
    case "ai_video": return `${base}/scene-${index}-ai-video.mp4`;
    case "stock_image": return `${base}/scene-${index}-stock.jpg`;
    case "stock_video": return `${base}/scene-${index}-stock.mp4`;
    case "text_card": return null;
  }
}

describe("getSceneAssetUrl", () => {
  const jobId = "test-job-123";
  const runDir = "2026-04-02-143022-black-holes";

  it("returns correct URL for ai_image", () => {
    const scene: DirectorScoreScene = {
      visual_type: "ai_image",
      visual_prompt: "a black hole",
      motion: "zoom_in",
      script_line: "What if you could fall in?",
    };
    expect(getSceneAssetUrl(jobId, runDir, scene, 0)).toBe(
      `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets/scene-0-ai.png`,
    );
    expect(getSceneAssetUrl(jobId, runDir, scene, 3)).toBe(
      `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets/scene-3-ai.png`,
    );
  });

  it("returns correct URL for stock_image", () => {
    const scene: DirectorScoreScene = {
      visual_type: "stock_image",
      visual_prompt: "galaxy photo",
      motion: "pan_right",
      script_line: "Stars stretch across the sky.",
    };
    expect(getSceneAssetUrl(jobId, runDir, scene, 1)).toBe(
      `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets/scene-1-stock.jpg`,
    );
  });

  it("returns correct URL for stock_video", () => {
    const scene: DirectorScoreScene = {
      visual_type: "stock_video",
      visual_prompt: "timelapse of stars",
      motion: "static",
      script_line: "Time moves differently here.",
    };
    expect(getSceneAssetUrl(jobId, runDir, scene, 2)).toBe(
      `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets/scene-2-stock.mp4`,
    );
  });

  it("returns null for text_card", () => {
    const scene: DirectorScoreScene = {
      visual_type: "text_card",
      visual_prompt: "Did you know?",
      motion: "static",
      script_line: "Here's an interesting fact.",
    };
    expect(getSceneAssetUrl(jobId, runDir, scene, 4)).toBeNull();
  });

  it("returns AI image URL when stock_image falls back", () => {
    const scene: DirectorScoreScene = {
      visual_type: "stock_image",
      visual_prompt: "galaxy photo",
      motion: "pan_right",
      script_line: "Stars stretch across the sky.",
    };
    const fallbacks: SceneFallbacks = { 1: "ai_image" };
    expect(getSceneAssetUrl(jobId, runDir, scene, 1, fallbacks)).toBe(
      `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets/scene-1-ai.png`,
    );
  });

  it("returns AI image URL when stock_video falls back", () => {
    const scene: DirectorScoreScene = {
      visual_type: "stock_video",
      visual_prompt: "timelapse of stars",
      motion: "static",
      script_line: "Time moves differently here.",
    };
    const fallbacks: SceneFallbacks = { 2: "ai_image" };
    expect(getSceneAssetUrl(jobId, runDir, scene, 2, fallbacks)).toBe(
      `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets/scene-2-ai.png`,
    );
  });

  it("returns AI image URL when ai_video falls back to image", () => {
    const scene: DirectorScoreScene = {
      visual_type: "ai_video",
      visual_prompt: "cosmic explosion",
      motion: "zoom_in",
      script_line: "The universe began with a bang.",
    };
    const fallbacks: SceneFallbacks = { 0: "ai_video_to_image" };
    expect(getSceneAssetUrl(jobId, runDir, scene, 0, fallbacks)).toBe(
      `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets/scene-0-ai.png`,
    );
  });

  it("ignores fallbacks for scenes not in the map", () => {
    const scene: DirectorScoreScene = {
      visual_type: "stock_image",
      visual_prompt: "galaxy photo",
      motion: "pan_right",
      script_line: "Stars stretch across the sky.",
    };
    const fallbacks: SceneFallbacks = { 5: "ai_image" };
    expect(getSceneAssetUrl(jobId, runDir, scene, 1, fallbacks)).toBe(
      `/api/v1/jobs/${jobId}/artifacts/${runDir}/assets/scene-1-stock.jpg`,
    );
  });
});

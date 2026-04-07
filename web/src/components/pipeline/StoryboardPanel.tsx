import { useCallback, useEffect, useRef, useState } from "react";
import type { DirectorScore } from "@/hooks/useApi";
import { getSceneAssetUrl, type SceneFallbacks } from "@/lib/scene-assets";
import { cn } from "@/lib/utils";
import { ImageOff, Pause, Play, Move, ArrowRight, Type } from "lucide-react";

const VISUAL_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  ai_image: { label: "AI", color: "bg-indigo-500/20 text-indigo-400" },
  ai_video: { label: "AV", color: "bg-purple-500/20 text-purple-400" },
  stock_image: { label: "ST", color: "bg-cyan-500/20 text-cyan-400" },
  stock_video: { label: "SV", color: "bg-emerald-500/20 text-emerald-400" },
  text_card: { label: "TX", color: "bg-amber-500/20 text-amber-400" },
};

const MOTION_ICON: Record<string, string> = {
  zoom_in: "Z+",
  zoom_out: "Z-",
  pan_right: "P→",
  pan_left: "P←",
  static: "ST",
};

interface StoryboardPanelProps {
  score: DirectorScore;
  jobId: string;
  runDir: string | null;
  visualsComplete: boolean;
  assetFailures: Array<{ scene: number; error: string }>;
  sceneFallbacks: SceneFallbacks;
}

export function StoryboardPanel({
  score,
  jobId,
  runDir,
  visualsComplete,
  assetFailures,
  sceneFallbacks,
}: StoryboardPanelProps) {
  const failedScenes = new Set(assetFailures.map((f) => f.scene));

  return (
    <div className="rounded-[10px] border border-[#334155] bg-[#1E293B] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#64748B]">
          DIRECTOR'S SCORE
        </span>
        <span className="text-xs font-medium text-[#22C55E]">
          {score.scenes.length} scenes planned
        </span>
      </div>

      {/* Emotional arc + music mood badges */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <span className="rounded-[5px] border border-[#6366F130] bg-[#6366F115] px-2 py-0.5 text-xs font-medium text-[#A5B4FC]">
          {score.emotional_arc}
        </span>
        <span className="rounded-[5px] border border-[#6366F130] bg-[#6366F115] px-2 py-0.5 text-xs font-medium text-[#A5B4FC]">
          {score.music_mood}
        </span>
      </div>

      {/* Scene grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {score.scenes.map((scene, i) => {
          const fallback = sceneFallbacks[i];
          const badge = fallback
            ? VISUAL_TYPE_BADGE["ai_image"]!
            : VISUAL_TYPE_BADGE[scene.visual_type] ?? {
                label: "??",
                color: "bg-gray-500/20 text-gray-400",
              };
          const isTextCard = scene.visual_type === "text_card";
          const thumbnailUrl =
            runDir && !isTextCard && visualsComplete
              ? getSceneAssetUrl(jobId, runDir, scene, i, sceneFallbacks)
              : null;
          const hasFailed = failedScenes.has(i);
          // A fallback that resolved to an image is no longer a video
          const isVideo =
            !fallback &&
            (scene.visual_type === "ai_video" || scene.visual_type === "stock_video");

          return (
            <StoryboardScene
              key={i}
              index={i}
              scriptLine={scene.script_line}
              visualPrompt={scene.visual_prompt}
              badge={badge}
              motion={MOTION_ICON[scene.motion] ?? ""}
              transition={scene.transition}
              thumbnailUrl={thumbnailUrl}
              hasFailed={hasFailed}
              visualsComplete={visualsComplete}
              isVideo={isVideo}
              isTextCard={isTextCard}
              fallback={fallback}
            />
          );
        })}
      </div>
    </div>
  );
}

function StoryboardScene({
  index,
  scriptLine,
  visualPrompt,
  badge,
  motion,
  transition,
  thumbnailUrl,
  hasFailed,
  visualsComplete,
  isVideo,
  isTextCard,
  fallback,
}: {
  index: number;
  scriptLine: string;
  visualPrompt: string;
  badge: { label: string; color: string };
  motion: string;
  transition?: string | null;
  thumbnailUrl: string | null;
  hasFailed: boolean;
  visualsComplete: boolean;
  isVideo: boolean;
  isTextCard: boolean;
  fallback?: string;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset error state when visuals complete so thumbnails retry loading.
  // NOTE: intentionally omit imgError from deps — including it creates an infinite
  // loop: fail → setImgError(true) → effect fires → setImgError(false) → retry → fail…
  // We only want to reset once, when the visuals stage transitions to complete.
  useEffect(() => {
    if (visualsComplete) {
      setImgError(false);
      setImgLoaded(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualsComplete]);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setPlaying(true);
    } else {
      vid.pause();
      setPlaying(false);
    }
  }, []);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] transition-colors hover:border-[#334155]">
      {/* Thumbnail area */}
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-[#0A0F1F]">
        {isTextCard ? (
          /* Text card preview */
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 bg-gradient-to-b from-[#1E293B] to-[#0F172A]">
            <Type className="size-4 text-amber-400/60" />
            <p className="text-center text-[10px] font-medium leading-snug text-[#94A3B8] line-clamp-4">
              {visualPrompt || scriptLine}
            </p>
          </div>
        ) : thumbnailUrl && !imgError ? (
          <>
            {isVideo ? (
              <video
                ref={videoRef}
                src={thumbnailUrl}
                className={cn(
                  "h-full w-full object-cover transition-opacity duration-500",
                  imgLoaded ? "opacity-100" : "opacity-0",
                )}
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedData={() => setImgLoaded(true)}
                onError={(e) => {
                  (e.target as HTMLVideoElement).removeAttribute("src");
                  (e.target as HTMLVideoElement).load();
                  setImgError(true);
                }}
                onEnded={() => setPlaying(false)}
              />
            ) : (
              <img
                src={thumbnailUrl}
                alt={`Scene ${index + 1}`}
                className={cn(
                  "h-full w-full object-cover transition-opacity duration-500",
                  imgLoaded ? "opacity-100" : "opacity-0",
                )}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            )}
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-4 animate-spin rounded-full border-2 border-[#334155] border-t-primary" />
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            {hasFailed ? (
              <ImageOff className="size-5 text-[#F59E0B]" />
            ) : !visualsComplete ? (
              <div className="size-4 animate-spin rounded-full border-2 border-[#334155] border-t-primary" />
            ) : (
              <span className="text-[10px] text-[#64748B]">—</span>
            )}
          </div>
        )}

        {/* Video play/pause overlay */}
        {isVideo && imgLoaded && (
          <button
            type="button"
            onClick={togglePlay}
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              playing ? "bg-transparent opacity-0 hover:opacity-100 hover:bg-black/20" : "bg-black/20 opacity-100",
            )}
          >
            {playing ? (
              <Pause className="size-6 text-white/80" />
            ) : (
              <Play className="size-6 text-white/80" />
            )}
          </button>
        )}

        {/* Scene number overlay */}
        <div className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded bg-black/60 text-[10px] font-bold text-white">
          {index + 1}
        </div>

        {/* Type badge overlay */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
          {fallback && (
            <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[8px] font-bold text-amber-400">
              FB
            </span>
          )}
          <span className={cn("rounded px-1 py-0.5 text-[9px] font-bold", badge.color)}>
            {badge.label}
          </span>
        </div>

        {/* Warning overlay for failed assets */}
        {hasFailed && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#F59E0B20] to-transparent px-2 py-1">
            <span className="text-[9px] font-medium text-[#F59E0B]">Asset failed</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        <p className="text-[11px] leading-snug text-[#CBD5E1] line-clamp-2">
          {scriptLine}
        </p>
        <div className="mt-auto flex items-center gap-1.5">
          {motion && (
            <span className="flex items-center gap-0.5 text-[9px] text-[#64748B]">
              <Move className="size-2.5" />
              {motion}
            </span>
          )}
          {transition && transition !== "none" && (
            <span className="flex items-center gap-0.5 text-[9px] text-[#64748B]">
              <ArrowRight className="size-2.5" />
              {transition}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

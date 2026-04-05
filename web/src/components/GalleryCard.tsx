import { useState } from "react";
import { Link } from "react-router-dom";
import type { JobSummary, DirectorScore } from "@/hooks/useApi";
import { getSceneAssetUrl } from "@/lib/scene-assets";
import { cn, formatArchetypeName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Clock, DollarSign, Layers, Star } from "lucide-react";

const ARCHETYPE_COLORS: Record<string, string> = {
  editorial_caricature: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  warm_narrative: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  studio_realism: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  infographic: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  anime_illustration: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  pastoral_watercolor: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  comic_book: "bg-lime-500/15 text-lime-400 border-lime-500/20",
  gothic_fantasy: "bg-red-500/15 text-red-400 border-red-500/20",
  vintage_snapshot: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  surreal_dreamscape: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  warm_editorial: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  cinematic_documentary: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  moody_cinematic: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  bold_illustration: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

interface GalleryCardProps {
  job: JobSummary;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  timeAgo: string;
}

export function GalleryCard({ job, bulkMode, selected, onToggleSelect, timeAgo }: GalleryCardProps) {
  const isFailed = job.status === "failed";
  const isRunning = job.status === "running" || job.status === "queued";
  const score = job.score as DirectorScore | undefined;
  const sceneCount = score?.scenes?.length;
  const criticScore = job.criticReview?.score;
  const cost = job.actualCost?.totalCost ?? job.costEstimate?.totalCost;
  const archetypeKey = job.archetype ?? "";
  const archetypeColor =
    ARCHETYPE_COLORS[archetypeKey] ?? "bg-secondary text-secondary-foreground";

  // Try to get first scene thumbnail
  const firstScene = score?.scenes?.[0];
  const thumbnailUrl =
    job.runDir && firstScene && firstScene.visual_type !== "text_card"
      ? getSceneAssetUrl(job.id, job.runDir, firstScene, 0)
      : null;
  const [imgError, setImgError] = useState(false);

  // Archetype color for gradient fallback
  const accentColor = archetypeKey
    ? getAccentFromArchetype(archetypeKey)
    : "#6366F1";

  return (
    <div className="relative group">
      {/* Checkbox overlay */}
      {bulkMode && (
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="border-white/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
      )}

      <Link
        to={`/jobs/${job.id}`}
        className={cn(
          "flex flex-col overflow-hidden rounded-[12px] border bg-[#1E293B] transition-all hover:border-primary/30",
          isFailed ? "border-[#EF444430]" : "border-[#334155]",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        {/* Thumbnail area */}
        <div
          className="relative flex h-[180px] items-center justify-center overflow-hidden"
          style={{
            background: thumbnailUrl && !imgError
              ? undefined
              : `linear-gradient(135deg, #0D1526 0%, ${accentColor}20 100%)`,
          }}
        >
          {thumbnailUrl && !imgError ? (
            <img
              src={thumbnailUrl}
              alt={job.topic}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : isFailed ? (
            <AlertTriangle className="size-8 text-destructive" />
          ) : isRunning ? (
            <div className="flex flex-col items-center gap-2">
              <div className="size-6 animate-spin rounded-full border-2 border-[#334155] border-t-[#22D3EE]" />
              <span className="text-[10px] text-[#64748B]">Generating...</span>
            </div>
          ) : (
            <Layers className="size-8 text-[#334155]" />
          )}

          {/* Running pulse badge */}
          {isRunning && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5">
              <span className="size-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
              <span className="text-[9px] text-[#22D3EE]">Running</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col p-3.5">
          <h3 className="text-sm font-semibold text-[#E2E8F0] line-clamp-2 leading-snug">
            {job.topic}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {job.archetype && (
              <Badge
                variant="outline"
                className={cn("text-[10px] font-normal border", archetypeColor)}
              >
                {formatArchetypeName(job.archetype)}
              </Badge>
            )}
            {isFailed && (
              <Badge variant="destructive" className="text-[10px] font-normal">
                Failed
              </Badge>
            )}
          </div>

          {/* Stats row */}
          <div className="mt-auto pt-2.5 flex items-center gap-3 text-[10px] text-[#64748B]">
            {sceneCount != null && (
              <span className="flex items-center gap-0.5">
                <Layers className="size-3" />
                {sceneCount}
              </span>
            )}
            {cost != null && (
              <span className="flex items-center gap-0.5">
                <DollarSign className="size-3" />
                {cost.toFixed(2)}
              </span>
            )}
            {criticScore != null && (
              <span className="flex items-center gap-0.5">
                <Star className="size-3" />
                {criticScore}/10
              </span>
            )}
            <span className="ml-auto flex items-center gap-0.5">
              <Clock className="size-3" />
              {timeAgo}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

function getAccentFromArchetype(name: string): string {
  const map: Record<string, string> = {
    editorial_caricature: "#F97316",
    warm_narrative: "#F59E0B",
    studio_realism: "#6366F1",
    infographic: "#14B8A6",
    anime_illustration: "#EC4899",
    pastoral_watercolor: "#06B6D4",
    comic_book: "#84CC16",
    gothic_fantasy: "#EF4444",
    vintage_snapshot: "#F43F5E",
    surreal_dreamscape: "#8B5CF6",
    warm_editorial: "#F97316",
    cinematic_documentary: "#3B82F6",
    moody_cinematic: "#64748B",
    bold_illustration: "#EAB308",
  };
  return map[name] ?? "#6366F1";
}

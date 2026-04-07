import type { DirectorScoreScene } from "@/hooks/useApi";

const VISUAL_TYPE_BADGE: Record<DirectorScoreScene["visual_type"], { label: string; color: string }> = {
  ai_image: { label: "AI", color: "bg-indigo-500/20 text-indigo-400" },
  ai_video: { label: "AV", color: "bg-purple-500/20 text-purple-400" },
  stock_image: { label: "ST", color: "bg-cyan-500/20 text-cyan-400" },
  stock_video: { label: "SV", color: "bg-emerald-500/20 text-emerald-400" },
  text_card: { label: "TX", color: "bg-amber-500/20 text-amber-400" },
};

interface SceneCardProps {
  index: number;
  scene: DirectorScoreScene;
  thumbnailUrl?: string | null;
}

export function SceneCard({ index, scene, thumbnailUrl }: SceneCardProps) {
  const badge = VISUAL_TYPE_BADGE[scene.visual_type];

  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-inset px-3 py-2.5">
      <span className="shrink-0 text-xs text-muted-foreground w-4 text-right">{index + 1}</span>

      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={`Scene ${index + 1}`}
          className="size-8 shrink-0 rounded object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}

      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.color}`}>
        {badge.label}
      </span>

      <span className="min-w-0 flex-1 text-[13px] leading-snug text-secondary-foreground line-clamp-2">
        {scene.script_line}
      </span>
    </div>
  );
}

import { cn, formatArchetypeName } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";
import type { Archetype } from "@/hooks/useApi";

interface ArchetypeCardProps {
  archetype: Archetype | null; // null = "Auto Style"
  selected: boolean;
  onClick: () => void;
}

export function ArchetypeCard({ archetype, selected, onClick }: ArchetypeCardProps) {
  const isAuto = archetype === null;
  const palette = archetype?.colorPalette;
  const pacing = archetype?.scenePacing;
  const mood = archetype?.mood?.split(",")[0]?.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 flex-col items-center justify-center rounded-xl border-2 px-3 py-4 transition-all snap-start",
        "w-[140px] h-[160px]",
        selected
          ? "border-primary shadow-[0_0_16px_-2px] shadow-primary/30"
          : "border-border hover:border-muted-foreground/50",
      )}
      style={
        isAuto
          ? undefined
          : palette
            ? {
                background: `linear-gradient(135deg, ${palette.background} 0%, ${palette.accent}30 100%)`,
              }
            : undefined
      }
    >
      {/* Selection check */}
      {selected && (
        <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary">
          <Check className="size-3 text-primary-foreground" />
        </div>
      )}

      {/* Auto style shimmer */}
      {isAuto ? (
        <>
          <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-status-info to-primary/70">
            <Sparkles className="size-5 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">Auto Style</span>
          <span className="mt-1 text-[10px] text-text-subtle">AI picks the best</span>
        </>
      ) : (
        <>
          {/* Color swatches */}
          <div className="mb-3 flex gap-1.5">
            {palette && (
              <>
                <span
                  className="size-4 rounded-full border border-white/10"
                  style={{ backgroundColor: palette.background }}
                />
                <span
                  className="size-4 rounded-full border border-white/10"
                  style={{ backgroundColor: palette.accent }}
                />
                <span
                  className="size-4 rounded-full border border-white/10"
                  style={{ backgroundColor: palette.text }}
                />
              </>
            )}
          </div>

          {/* Name */}
          <span className="text-center text-xs font-semibold text-foreground leading-tight">
            {formatArchetypeName(archetype.name)}
          </span>

          {/* Mood */}
          {mood && (
            <span className="mt-1 text-center text-[10px] text-text-subtle leading-tight line-clamp-1">
              {mood}
            </span>
          )}

          {/* Pacing badge */}
          {pacing && (
            <span className="mt-2 rounded-full bg-surface-inset px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
              {pacing}
            </span>
          )}
        </>
      )}
    </button>
  );
}

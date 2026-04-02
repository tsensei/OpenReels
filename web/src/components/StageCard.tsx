import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

type TimelineStatus = "done" | "running" | "pending" | "error" | "skipped";

export interface StageCardProps {
  name: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  detail?: string;
  durationSec?: number;
  isFirst?: boolean;
  isLast?: boolean;
  prevStatus?: TimelineStatus;
  subStatus?: string;
}

export const STAGE_LABELS: Record<string, string> = {
  research: "Research",
  director: "Creative Director",
  tts: "Voice Synthesis",
  visuals: "Visual Assets",
  assembly: "Assembly & Render",
  critic: "Quality Review",
};

const STAGE_RUNNING_TEXT: Record<string, string> = {
  research: "Researching topic...",
  director: "Writing script...",
  tts: "Synthesizing voiceover...",
  visuals: "Generating visuals...",
  assembly: "Rendering video...",
  critic: "Reviewing quality...",
};

/* ------------------------------------------------------------------ */
/*  Indicator                                                          */
/* ------------------------------------------------------------------ */

const statusIndicatorClasses: Record<TimelineStatus, string> = {
  done: "border-emerald-500 bg-emerald-500/10 text-emerald-400",
  running: "border-primary bg-primary/10 text-primary",
  error: "border-destructive bg-destructive/10 text-destructive",
  skipped: "border-muted-foreground/30 bg-muted text-muted-foreground/50",
  pending: "border-muted-foreground/20 bg-muted text-muted-foreground/30",
};

function IndicatorIcon({ status }: { status: TimelineStatus }) {
  switch (status) {
    case "done":
      return (
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "running":
      return (
        <svg
          className="size-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      );
    case "error":
      return (
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "skipped":
      return (
        <svg
          className="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      );
    default:
      return <div className="size-2 rounded-full bg-current" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Connector line colors                                              */
/* ------------------------------------------------------------------ */

const statusLineClasses: Record<TimelineStatus, string> = {
  done: "bg-emerald-500/30",
  running: "bg-primary/20",
  error: "bg-destructive/30",
  skipped: "bg-muted-foreground/10",
  pending: "bg-muted-foreground/10",
};

/* ------------------------------------------------------------------ */
/*  StageCard                                                          */
/*                                                                     */
/*  Layout uses CSS Grid with a stretched first column:                */
/*                                                                     */
/*    grid-template-columns: 32px 1fr                                  */
/*    Row 1: auto (card height)                                        */
/*                                                                     */
/*  The lines are absolutely positioned in the first column            */
/*  to connect exactly to the next card without any gaps.              */
/* ------------------------------------------------------------------ */

export function StageCard({
  name,
  status,
  detail,
  durationSec,
  isFirst,
  isLast,
  prevStatus,
  subStatus,
}: StageCardProps) {
  const label = STAGE_LABELS[name] ?? name;

  const statusText =
    status === "done" && durationSec != null
      ? `Completed · ${durationSec.toFixed(1)}s`
      : status === "done"
        ? "Completed"
        : status === "running"
          ? subStatus || detail || STAGE_RUNNING_TEXT[name] || "Processing..."
          : status === "error"
            ? "Failed"
            : status === "skipped"
              ? "Skipped"
              : "Pending";

  const isActive = status === "running" || status === "done" || status === "error";

  return (
    <li
      className="relative grid"
      style={{
        gridTemplateColumns: "32px 1fr",
        columnGap: 12,
        paddingBottom: isLast ? 0 : 24,
      }}
    >
      {/* Col 1: Indicator and Timeline lines */}
      <div className="relative flex flex-col items-center justify-center">
        {/* Top line: from top of the grid cell down to the circle */}
        {!isFirst && prevStatus && (
          <div
            className={cn("absolute w-0.5 transition-colors", statusLineClasses[prevStatus])}
            style={{
              top: 0,
              bottom: "calc(50% + 16px)", // Stops exactly at the top of the 32px circle
            }}
          />
        )}

        {/* Bottom line: from the bottom of the circle, through the padding gap, to the top of the next grid cell */}
        {!isLast && (
          <div
            className={cn("absolute w-0.5 transition-colors", statusLineClasses[status])}
            style={{
              top: "calc(50% + 16px)", // Starts exactly at the bottom of the 32px circle
              bottom: "-24px", // Reaches down through the 24px paddingBottom
              zIndex: 1,
            }}
          />
        )}

        <div
          className={cn(
            "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            statusIndicatorClasses[status],
          )}
        >
          <IndicatorIcon status={status} />
        </div>
      </div>

      {/* Col 2: Card content */}
      <div
        className={cn(
          "rounded-lg px-3.5 py-2.5 transition-all min-w-0",
          status === "running" && "bg-[#1E293B] ring-1 ring-primary/25",
          status === "error" && "bg-[#1E293B] ring-1 ring-destructive/25",
          status === "done" && "bg-[#141C2E]",
          (status === "pending" || status === "skipped") && "opacity-50",
        )}
      >
        <span
          className={cn(
            "block text-[13px] font-medium leading-tight",
            !isActive && "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-xs leading-tight",
            status === "done" && "text-emerald-400/80",
            status === "running" && "text-primary/80",
            status === "error" && "text-destructive/80",
            (status === "pending" || status === "skipped") && "text-muted-foreground/70",
          )}
        >
          {statusText}
        </span>
      </div>
    </li>
  );
}

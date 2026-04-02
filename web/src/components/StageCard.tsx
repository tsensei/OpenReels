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
  isLast?: boolean;
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
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "running":
      return (
        <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      );
    case "error":
      return (
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "skipped":
      return (
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
/*  Layout uses CSS Grid with 2 rows:                                  */
/*                                                                     */
/*    Row 1 (items-center):  [indicator]  [card]                       */
/*    Row 2 (connector gap): [line     ]  [    ]                       */
/*                                                                     */
/*    grid-template-columns: 32px 1fr                                  */
/*    Row 1: auto (card height)                                        */
/*    Row 2: 24px gap (connector extends through it)                   */
/*                                                                     */
/*  The indicator is centered with the card via align-items: center     */
/*  on the first row. The connector occupies the full second row.      */
/* ------------------------------------------------------------------ */

export function StageCard({ name, status, detail, durationSec, isLast, subStatus }: StageCardProps) {
  const label = STAGE_LABELS[name] ?? name;

  const statusText =
    status === "done" && durationSec != null
      ? `Completed · ${durationSec.toFixed(1)}s`
      : status === "done"
        ? "Completed"
        : status === "running"
          ? (subStatus || detail || STAGE_RUNNING_TEXT[name] || "Processing...")
          : status === "error"
            ? "Failed"
            : status === "skipped"
              ? "Skipped"
              : "Pending";

  const isActive = status === "running" || status === "done" || status === "error";

  return (
    <li
      className="relative grid items-center"
      style={{
        gridTemplateColumns: "32px 1fr",
        columnGap: 12,
        paddingBottom: isLast ? 0 : 24,
      }}
    >
      {/* Connector: absolutely positioned from center of indicator to bottom of li (through pb) */}
      {!isLast && (
        <div
          className={cn("absolute w-0.5 transition-colors", statusLineClasses[status])}
          style={{
            left: 15, // center of 32px column
            top: "50%",
            bottom: 0,
          }}
        />
      )}

      {/* Col 1: Indicator — grid items-center aligns it with card */}
      <div
        className={cn(
          "relative z-10 flex size-8 items-center justify-center justify-self-center rounded-full border-2 transition-colors",
          statusIndicatorClasses[status],
        )}
      >
        <IndicatorIcon status={status} />
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
        <span className={cn("block text-[13px] font-medium leading-tight", !isActive && "text-muted-foreground")}>
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

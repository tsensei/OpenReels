import { cn } from "@/lib/utils";
import { Check, X, Loader2, SkipForward } from "lucide-react";

export interface StageCardProps {
  name: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  detail?: string;
  durationSec?: number;
  isLast?: boolean;
}

const STAGE_LABELS: Record<string, string> = {
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

function StatusIcon({ status }: { status: StageCardProps["status"] }) {
  switch (status) {
    case "done":
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[14px] bg-[#22C55E20]">
          <Check className="size-3.5 text-emerald-400" />
        </div>
      );
    case "running":
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[14px] bg-[#6366F130]">
          <Loader2 className="size-3.5 animate-spin text-primary" />
        </div>
      );
    case "error":
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[14px] bg-[#EF444420]">
          <X className="size-3.5 text-destructive" />
        </div>
      );
    case "skipped":
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-[#334155]">
          <SkipForward className="size-3.5 text-muted-foreground" />
        </div>
      );
    default:
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-[#334155]" />
      );
  }
}

export function StageCard({ name, status, detail, durationSec, isLast }: StageCardProps) {
  const label = STAGE_LABELS[name] ?? name;

  const connectorColor =
    status === "done"
      ? "#22C55E40"
      : status === "error"
        ? "#EF444440"
        : status === "running"
          ? "#334155"
          : "#1E293B";

  return (
    <div>
      <div className="flex gap-3.5">
        {/* Icon */}
        <div className="pt-0.5">
          <StatusIcon status={status} />
        </div>

        {/* Content */}
        <div
          className={cn(
            "mb-0 flex-1 rounded-[10px] px-4 py-3 transition-colors",
            status === "running" && "bg-[#1E293B] ring-1 ring-[#6366F150]",
            status === "error" && "bg-[#EF444410] ring-1 ring-[#EF444440]",
            status === "done" && "bg-[#12192D]",
            (status === "pending" || status === "skipped") && "bg-transparent px-0 opacity-50"
          )}
        >
          {/* Stage name */}
          <span
            className={cn(
              "block text-sm font-medium",
              status === "pending" && "text-muted-foreground"
            )}
          >
            {label}
          </span>

          {/* Status line below */}
          <span
            className={cn(
              "block text-xs",
              status === "done" && "text-emerald-400",
              status === "running" && "text-primary",
              status === "error" && "text-destructive",
              status === "pending" && "text-muted-foreground",
              status === "skipped" && "text-muted-foreground"
            )}
          >
            {status === "done" && durationSec != null
              ? `Completed · ${durationSec.toFixed(1)}s`
              : status === "done"
                ? "Completed"
                : status === "running"
                  ? (detail || STAGE_RUNNING_TEXT[name] || "Processing...")
                  : status === "error"
                    ? `Failed${detail ? ` — ${detail}` : ""}`
                    : status === "skipped"
                      ? "Skipped"
                      : "Pending"}
          </span>
        </div>
      </div>

      {/* Connector */}
      {!isLast && (
        <div className="flex h-5 pl-[13px]">
          <div className="h-full w-0.5" style={{ backgroundColor: connectorColor }} />
        </div>
      )}
    </div>
  );
}

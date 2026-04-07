import type { CostBreakdown, ActualCostBreakdown } from "@/hooks/useApi";

interface CostBreakdownCardProps {
  estimate?: CostBreakdown | null;
  actual?: ActualCostBreakdown | null;
  variant?: "compact" | "full";
}

export function CostBreakdownCard({ estimate, actual, variant = "compact" }: CostBreakdownCardProps) {
  const cost = actual ?? estimate;
  if (!cost) return null;

  const hasVideo = (cost.videoCost ?? 0) > 0;
  const hasMusic = (cost.musicCost ?? 0) > 0;

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border bg-card px-4 py-3">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[1.5px] text-muted-foreground">
          {actual ? "COST BREAKDOWN" : "COST ESTIMATE"}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <CostItem label="LLM" value={cost.llmCost} />
          <CostItem label="TTS" value={cost.ttsCost} />
          <CostItem label="Images" value={cost.imageCost} />
          {hasVideo && <CostItem label="Video" value={cost.videoCost} />}
          {hasMusic && <CostItem label="Music" value={cost.musicCost} />}
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-status-info">
              ${cost.totalCost.toFixed(2)}
            </span>
            <span className="text-[10px] text-muted-foreground">Total</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border bg-card px-4 py-3">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[1.5px] text-muted-foreground">
        COST BREAKDOWN
      </span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CostItem label="LLM" value={cost.llmCost} />
        <CostItem label="TTS" value={cost.ttsCost} />
        <CostItem label="Images" value={cost.imageCost} />
        {hasVideo && <CostItem label="Video" value={cost.videoCost} />}
        {hasMusic && <CostItem label="Music" value={cost.musicCost} />}
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-status-info">
            ${cost.totalCost.toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </div>
      </div>
    </div>
  );
}

function formatCost(value: number): string {
  if (value === 0) return "$0.00";
  if (value > 0 && value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}

function CostItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-semibold text-secondary-foreground">
        {formatCost(value)}
      </span>
    </div>
  );
}

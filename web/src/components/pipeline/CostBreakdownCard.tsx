import type { CostBreakdown, ActualCostBreakdown } from "@/hooks/useApi";

interface CostBreakdownCardProps {
  estimate?: CostBreakdown | null;
  actual?: ActualCostBreakdown | null;
  variant?: "compact" | "full";
}

export function CostBreakdownCard({ estimate, actual, variant = "compact" }: CostBreakdownCardProps) {
  const cost = actual ?? estimate;
  if (!cost) return null;

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#334155] bg-[#1E293B] px-4 py-3">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#64748B]">
          {actual ? "COST BREAKDOWN" : "COST ESTIMATE"}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <CostItem label="LLM" value={cost.llmCost} />
          <CostItem label="TTS" value={cost.ttsCost} />
          <CostItem label="Images" value={cost.imageCost} />
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-[#22D3EE]">
              ${cost.totalCost.toFixed(2)}
            </span>
            <span className="text-[10px] text-[#64748B]">Total</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#334155] bg-[#1E293B] px-4 py-3">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#64748B]">
        COST BREAKDOWN
      </span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CostItem label="LLM" value={cost.llmCost} />
        <CostItem label="TTS" value={cost.ttsCost} />
        <CostItem label="Images" value={cost.imageCost} />
      </div>
    </div>
  );
}

function CostItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-[#64748B]">{label}</span>
      <span className="text-[11px] font-semibold text-[#CBD5E1]">
        ${value.toFixed(2)}
      </span>
    </div>
  );
}

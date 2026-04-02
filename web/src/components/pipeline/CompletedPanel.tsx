import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import type {
  CostBreakdown,
  CriticReview,
  DirectorScore,
  JobSummary,
} from "@/hooks/useApi";
import { CostBreakdownCard } from "./CostBreakdownCard";

interface CompletedPanelProps {
  job: JobSummary;
  score: DirectorScore | null;
  criticReview: CriticReview | null;
  costEstimate: CostBreakdown | null;
  totalDuration: number;
}

export function CompletedPanel({
  job,
  score,
  criticReview,
  costEstimate,
  totalDuration,
}: CompletedPanelProps) {
  const videoUrl = job.videoPath
    ? `/api/v1/jobs/${job.id}/artifacts/${job.videoPath}`
    : null;
  const totalCost = job.actualCost?.totalCost ?? job.costEstimate?.totalCost;

  // Fetch score.json for completed jobs if not already available from SSE
  const [fetchedScore, setFetchedScore] = useState<DirectorScore | null>(null);
  useEffect(() => {
    if (score || !job.runDir) return;
    fetch(`/api/v1/jobs/${job.id}/artifacts/${job.runDir}/score.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFetchedScore(data as DirectorScore);
      })
      .catch(() => {});
  }, [score, job.id, job.runDir]);

  const displayScore = score ?? fetchedScore;
  const displayCritic = criticReview ?? job.criticReview;
  const sceneCount = displayScore?.scenes.length ?? null;

  return (
    <div className="flex flex-col sm:flex-row gap-5">
      {/* Video Player */}
      <div className="shrink-0 flex w-full sm:w-[220px] md:w-[280px] max-w-[280px] mx-auto sm:mx-0 flex-col items-center justify-center aspect-[9/16] rounded-xl overflow-hidden border border-[#334155] bg-[#0D1526]">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            playsInline
            className="h-full w-full object-contain"
          >
            <track kind="captions" />
          </video>
        ) : (
          <>
            <Play className="size-10 text-[#818CF8]" />
            <span className="mt-2.5 text-xs text-[#94A3B8]">
              Video not available
            </span>
          </>
        )}
      </div>

      {/* Right column: Stats + Quality + Cost */}
      <div className="min-w-0 flex flex-1 flex-col gap-3">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard label="Total Time" value={`${totalDuration.toFixed(1)}s`} />
          <StatCard
            label="Total Cost"
            value={totalCost != null ? `$${totalCost.toFixed(2)}` : "—"}
            highlight
          />
          <StatCard label="Scenes" value={String(sceneCount ?? "—")} />
        </div>

        {/* Quality Review (inlined CriticReview) */}
        {displayCritic && (
          <div className="flex flex-1 flex-col rounded-[10px] border border-[#334155] bg-[#1E293B] p-4 gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#64748B]">
                QUALITY REVIEW
              </span>
              <span className="rounded-[5px] bg-[#22C55E15] px-2 py-0.5 text-xs font-bold text-[#22C55E]">
                {displayCritic.score}/10
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {displayCritic.strengths.map((s, i) => (
                <div key={`s-${i}`} className="flex items-start gap-1.5">
                  <span className="shrink-0 text-[11px] text-[#22C55E]">+</span>
                  <span className="text-[11px] leading-snug text-[#94A3B8]">{s}</span>
                </div>
              ))}
              {displayCritic.weaknesses.map((w, i) => (
                <div key={`w-${i}`} className="flex items-start gap-1.5">
                  <span className="shrink-0 text-[11px] text-[#EF4444]">&minus;</span>
                  <span className="text-[11px] leading-snug text-[#94A3B8]">{w}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost Breakdown */}
        <CostBreakdownCard
          estimate={costEstimate ?? job.costEstimate}
          actual={job.actualCost}
          variant="full"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-[10px] border border-[#334155] bg-[#1E293B] px-3 py-3 sm:px-4 sm:py-3.5 gap-1">
      <span
        className={`text-lg font-bold ${highlight ? "text-[#22D3EE]" : "text-[#F1F5F9]"}`}
      >
        {value}
      </span>
      <span className="text-[11px] text-[#94A3B8]">{label}</span>
    </div>
  );
}

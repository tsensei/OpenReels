import type {
  CostBreakdown,
  DirectorScore,
  ResearchData,
} from "@/hooks/useApi";
import { SceneCard } from "./SceneCard";
import { CostBreakdownCard } from "./CostBreakdownCard";

interface RunningPanelProps {
  researchData: ResearchData | null;
  score: DirectorScore | null;
  costEstimate: CostBreakdown | null;
  assetFailures: Array<{ scene: number; error: string }>;
  stages: Record<string, { status: string; detail?: string; durationSec?: number }>;
}

export function RunningPanel({
  researchData,
  score,
  costEstimate,
  assetFailures,
  stages,
}: RunningPanelProps) {
  const hasResearch = researchData != null;
  const hasScore = score != null;
  const hasCost = costEstimate != null;

  if (!hasResearch && !hasScore && !hasCost) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-[#64748B]">
          Pipeline output will appear here as stages complete...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Research Summary */}
      {hasResearch && (
        <div className="rounded-[10px] border border-[#334155] bg-[#1E293B] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#64748B]">
              RESEARCH SUMMARY
            </span>
            <span className="text-xs font-medium text-[#22C55E]">
              {researchData.key_facts.length} facts
            </span>
          </div>
          <p className="mb-3 text-[13px] leading-relaxed text-[#CBD5E1]">
            {researchData.summary}
          </p>
          {researchData.key_facts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {researchData.key_facts.slice(0, 5).map((fact, i) => (
                <span
                  key={i}
                  className="rounded-md bg-[#0F172A] px-2 py-1 text-[11px] text-[#94A3B8]"
                >
                  {fact}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Director Score */}
      {hasScore && (
        <div className="rounded-[10px] border border-[#334155] bg-[#1E293B] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#64748B]">
              DIRECTOR SCORE
            </span>
            <span className="text-xs font-medium text-[#22C55E]">
              {score.scenes.length} scenes
            </span>
          </div>

          {/* Emotional arc + music mood badges */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="rounded-[5px] border border-[#6366F130] bg-[#6366F115] px-2 py-0.5 text-xs font-medium text-[#A5B4FC]">
              {score.emotional_arc}
            </span>
            <span className="rounded-[5px] border border-[#6366F130] bg-[#6366F115] px-2 py-0.5 text-xs font-medium text-[#A5B4FC]">
              {score.music_mood}
            </span>
          </div>

          {/* Scene list */}
          <div className="flex flex-col gap-1.5">
            {score.scenes.map((scene, i) => (
              <SceneCard key={i} index={i} scene={scene} />
            ))}
          </div>
        </div>
      )}

      {/* Cost Estimate */}
      {hasCost && <CostBreakdownCard estimate={costEstimate} variant="compact" />}

      {/* Asset Failures */}
      {assetFailures.length > 0 && (
        <div className="rounded-[10px] border border-[#F59E0B30] bg-[#F59E0B10] p-4">
          <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#F59E0B]">
            ASSET WARNINGS
          </span>
          <div className="mt-2 flex flex-col gap-1">
            {assetFailures.map((f, i) => (
              <p key={i} className="text-[12px] text-[#FBBF24]">
                Scene {f.scene}: {f.error}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* TTS badge (from stage detail) */}
      {stages.tts?.status === "done" && stages.tts.detail && (
        <div className="rounded-[10px] border border-[#334155] bg-[#1E293B] px-4 py-2.5">
          <span className="text-[11px] text-[#94A3B8]">
            Voice synthesis: {stages.tts.detail}
          </span>
        </div>
      )}
    </div>
  );
}

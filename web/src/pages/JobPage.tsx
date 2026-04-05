import { AlertTriangle, Download, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CompletedPanel } from "@/components/pipeline/CompletedPanel";
import { FailedPanel } from "@/components/pipeline/FailedPanel";
import { StoryboardPanel } from "@/components/pipeline/StoryboardPanel";
import { CostBreakdownCard } from "@/components/pipeline/CostBreakdownCard";
import { STAGE_LABELS, StageCard } from "@/components/StageCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  api,
  type CostBreakdown,
  type CriticReview,
  type DirectorScore,
  type JobSummary,
  type ResearchData,
} from "@/hooks/useApi";
import { useSSE } from "@/hooks/useSSE";
import { formatArchetypeName } from "@/lib/utils";

const STAGES = ["research", "director", "tts", "visuals", "assembly", "critic"] as const;

interface MusicInfo {
  status: "idle" | "generating" | "generated" | "fallback";
  provider?: string;
  prompt?: string;
  reason?: string;
}

export function JobPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobSummary | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Rich SSE state
  const [score, setScore] = useState<DirectorScore | null>(null);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [criticReview, setCriticReview] = useState<CriticReview | null>(null);
  const [costEstimate, setCostEstimate] = useState<CostBreakdown | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState<{
    phase: string;
    totalFrames?: number;
  } | null>(null);
  const [assetFailures, setAssetFailures] = useState<Array<{ scene: number; error: string }>>([]);
  const [musicInfo, setMusicInfo] = useState<MusicInfo>({ status: "idle" });

  useEffect(() => {
    if (!id) return;
    // Reset all state when navigating to a different job
    setJob(null);
    setError("");
    setScore(null);
    setResearchData(null);
    setCriticReview(null);
    setCostEstimate(null);
    setAssemblyProgress(null);
    setAssetFailures([]);
    setMusicInfo({ status: "idle" });
    setCancelling(false);

    api
      .getJob(id)
      .then((j) => {
        setJob(j);
        // Restore rich data from meta.json (SSE reconnection support)
        if (j.researchData) setResearchData(j.researchData);
        if (j.score) setScore(j.score as DirectorScore);
        if (j.criticReview) setCriticReview(j.criticReview);
        if (j.costEstimate) setCostEstimate(j.costEstimate);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  const handleSSEEvent = useCallback(
    ({ event, data }: { event: string; data: unknown }) => {
      const d = data as Record<string, unknown>;

      if (event === "job:snapshot") {
        const snapshot = d as unknown as JobSummary;
        setJob(snapshot);
        // Restore rich data from snapshot
        if (snapshot.researchData) setResearchData(snapshot.researchData);
        if (snapshot.score) setScore(snapshot.score as DirectorScore);
        if (snapshot.criticReview) setCriticReview(snapshot.criticReview);
        if (snapshot.costEstimate) setCostEstimate(snapshot.costEstimate);
        return;
      }

      if (event === "job:completed" || event === "job:failed") {
        if (id)
          api
            .getJob(id)
            .then(setJob)
            .catch(() => {});
        return;
      }

      if (event.startsWith("stage:")) {
        const stageName = d.stage as string;
        const type = d.type as string;

        // Handle stage status updates
        if (type === "start" || type === "complete" || type === "skipped" || type === "error") {
          setJob((prev) => {
            if (!prev) return prev;
            const stages = { ...prev.stages };
            if (type === "start") {
              stages[stageName] = { status: "running" };
            } else if (type === "complete") {
              stages[stageName] = {
                status: "done",
                detail: d.detail as string,
                durationSec: d.durationSec as number,
              };
            } else if (type === "skipped") {
              stages[stageName] = { status: "skipped", detail: d.reason as string };
            } else if (type === "error") {
              stages[stageName] = { status: "error", detail: d.error as string };
            }
            return { ...prev, stages };
          });
          return;
        }

        // Handle rich progress events
        if (type === "cost_estimate") {
          setCostEstimate(d.estimate as CostBreakdown);
        } else if (type === "score") {
          setScore(d.score as DirectorScore);
        } else if (type === "results") {
          setResearchData({
            summary: d.summary as string,
            key_facts: d.key_facts as string[],
            mood: d.mood as string,
          });
        } else if (type === "review") {
          setCriticReview({
            score: d.score as number,
            strengths: d.strengths as string[],
            weaknesses: d.weaknesses as string[],
          });
        } else if (type === "bundling") {
          setAssemblyProgress({ phase: "bundling" });
        } else if (type === "rendering") {
          setAssemblyProgress({
            phase: "rendering",
            totalFrames: d.totalFrames as number | undefined,
          });
        } else if (type === "asset_failed") {
          setAssetFailures((prev) => [
            ...prev,
            { scene: d.scene as number, error: d.error as string },
          ]);
        } else if (type === "music_generating") {
          setMusicInfo({ status: "generating", provider: d.provider as string });
        } else if (type === "music_generated") {
          setMusicInfo({
            status: "generated",
            provider: d.provider as string,
            prompt: d.prompt as string | undefined,
          });
        } else if (type === "music_fallback") {
          setMusicInfo({
            status: "fallback",
            reason: d.reason as string | undefined,
          });
        }
      }
    },
    [id],
  );

  useSSE(id, handleSSEEvent);

  const handleCancel = async () => {
    if (!id || cancelling) return;
    setCancelling(true);
    try {
      await api.cancelJob(id);
      if (id)
        api
          .getJob(id)
          .then(setJob)
          .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    }
    setCancelling(false);
  };

  if (error && !job) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-center">
        <AlertTriangle className="mb-4 size-10 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/")}>
          Back to home
        </Button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isRunning = job.status === "running" || job.status === "queued";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isCancelled = job.status === "cancelled";
  const videoUrl = job.videoPath ? `/api/v1/jobs/${job.id}/artifacts/${job.videoPath}` : null;

  // Find the failed stage for error display
  const failedStage = isFailed
    ? (STAGES.find((s) => job.stages?.[s]?.status === "error") ??
      STAGES.find((s) => job.stages?.[s]?.status === "running") ??
      null)
    : null;
  const failedDetail = failedStage
    ? (job.stages?.[failedStage]?.detail ?? job.error ?? null)
    : (job.error ?? null);

  // Compute total duration
  const totalDuration = STAGES.reduce((sum, s) => {
    const d = job.stages?.[s]?.durationSec;
    return sum + (d ?? 0);
  }, 0);

  const totalCost = job.actualCost?.totalCost ?? job.costEstimate?.totalCost;

  // Assembly sub-status for StageCard
  const assemblySubStatus = assemblyProgress
    ? assemblyProgress.phase === "bundling"
      ? "Bundling..."
      : assemblyProgress.totalFrames
        ? `Rendering ${assemblyProgress.totalFrames} frames`
        : "Rendering..."
    : undefined;

  // Stage status helpers
  const visualsComplete = job.stages?.visuals?.status === "done" || job.stages?.visuals?.status === "skipped";

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg sm:text-[22px] font-bold">{job.topic}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {job.archetype && (
              <Badge
                variant="secondary"
                className="rounded-md border-0 bg-[#6366F120] px-2.5 py-1 text-xs font-medium text-[#A5B4FC]"
              >
                {formatArchetypeName(job.archetype)}
              </Badge>
            )}
            <span className="text-xs text-[#64748B]">YouTube Shorts</span>
            {totalCost != null && (
              <>
                <span className="text-xs text-[#475569]">&middot;</span>
                <span className="text-xs text-[#64748B]">
                  ~${totalCost.toFixed(2)} {job.actualCost ? "total" : "estimated"}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#334155] bg-[#1E293B] px-3.5 py-1.5">
              <div className="size-2 rounded-full bg-[#22D3EE] animate-pulse" />
              <span className="text-[13px] font-medium text-[#22D3EE]">Generating...</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1.5 rounded-lg bg-[#22C55E20] px-3.5 py-1.5">
              <div className="size-2 rounded-full bg-[#22C55E]" />
              <span className="text-[13px] font-medium text-[#22C55E]">Complete</span>
            </div>
          )}
          {isFailed && (
            <div className="flex items-center gap-1.5 rounded-lg bg-[#EF444420] px-3.5 py-1.5">
              <div className="size-2 rounded-full bg-[#EF4444]" />
              <span className="text-[13px] font-medium text-[#EF4444]">Failed</span>
            </div>
          )}
          {isCancelled && (
            <div className="flex items-center gap-1.5 rounded-lg bg-[#F59E0B20] px-3.5 py-1.5">
              <div className="size-2 rounded-full bg-[#F59E0B]" />
              <span className="text-[13px] font-medium text-[#F59E0B]">Cancelled</span>
            </div>
          )}

          {isRunning && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg border-[#334155] px-3.5 py-1.5 text-[13px] font-medium text-[#CBD5E1]"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling..." : "Cancel"}
            </Button>
          )}
          {isCompleted && videoUrl && (
            <a href={videoUrl} download>
              <Button size="sm" className="gap-2 rounded-lg px-4 py-2">
                <Download className="size-3.5" />
                Download
              </Button>
            </a>
          )}
          {!isRunning && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg border-[#334155] px-4 py-2 text-[13px] font-medium text-[#94A3B8]"
              onClick={() => navigate("/")}
            >
              <Plus className="size-3.5" />
              New Short
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout — stacks on mobile */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-7">
        {/* Left: Pipeline Timeline — sticky on desktop */}
        <ol className="w-full lg:w-[280px] lg:shrink-0 lg:sticky lg:top-6 lg:self-start list-none m-0 p-0">
          {STAGES.map((stage, i) => {
            const stageData = job.stages?.[stage];
            const prevStageName = i > 0 ? STAGES[i - 1] : undefined;
            const prevStatus = prevStageName
              ? ((job.stages?.[prevStageName]?.status as
                  | "pending"
                  | "running"
                  | "done"
                  | "skipped"
                  | "error") ?? "pending")
              : undefined;

            return (
              <StageCard
                key={stage}
                name={stage}
                status={(stageData?.status as "pending") ?? "pending"}
                detail={stageData?.detail}
                durationSec={stageData?.durationSec}
                isFirst={i === 0}
                isLast={i === STAGES.length - 1}
                prevStatus={prevStatus}
                subStatus={stage === "assembly" ? assemblySubStatus : undefined}
              />
            );
          })}
        </ol>

        {/* Right: Progressive Card Feed */}
        <div className="min-w-0 flex-1 flex flex-col gap-3">
          {/* Completed: video player + stats at top */}
          {isCompleted && (
            <CompletedPanel
              job={job}
              score={score}
              criticReview={criticReview}
              costEstimate={costEstimate}
              totalDuration={totalDuration}
            />
          )}

          {/* Failed/cancelled error card */}
          {(isFailed || isCancelled) && (
            <FailedPanel
              failedStageName={
                isCancelled
                  ? "Pipeline"
                  : failedStage
                    ? (STAGE_LABELS[failedStage] ?? failedStage)
                    : "Unknown Stage"
              }
              failedDetail={isCancelled ? "Job was cancelled by user" : failedDetail}
            />
          )}

          {/* Research card — always visible once available */}
          {researchData && (
            <ResearchCard data={researchData} />
          )}

          {/* Storyboard — always visible once score available */}
          {score && (
            <StoryboardPanel
              score={score}
              jobId={job.id}
              runDir={job.runDir ?? null}
              visualsComplete={!!visualsComplete}
              assetFailures={assetFailures}
            />
          )}

          {/* Cost estimate — shown during generation */}
          {costEstimate && !isCompleted && (
            <CostBreakdownCard estimate={costEstimate} variant="compact" />
          )}

          {/* Music status — live during visuals */}
          {musicInfo.status !== "idle" && !isCompleted && (
            <MusicStatusCard info={musicInfo} />
          )}

          {/* Asset failure warnings */}
          {assetFailures.length > 0 && !isCompleted && (
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

          {/* TTS badge */}
          {job.stages?.tts?.status === "done" && job.stages.tts.detail && !isCompleted && (
            <div className="rounded-[10px] border border-[#334155] bg-[#1E293B] px-4 py-2.5">
              <span className="text-[11px] text-[#94A3B8]">
                Voice synthesis: {job.stages.tts.detail}
              </span>
            </div>
          )}

          {/* Empty state while waiting */}
          {!researchData && !score && !costEstimate && isRunning && (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-[#64748B]">
                Pipeline output will appear here as stages complete...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Inline sub-components ─── */

function ResearchCard({ data }: { data: ResearchData }) {
  const [expanded, setExpanded] = useState(false);
  const facts = expanded ? data.key_facts : data.key_facts.slice(0, 5);

  return (
    <div className="rounded-[10px] border border-[#334155] bg-[#1E293B] p-4 animate-in fade-in duration-500">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#64748B]">
            RESEARCH SUMMARY
          </span>
          {data.mood && (
            <span className="rounded-full bg-[#0F172A] px-2 py-0.5 text-[10px] text-[#94A3B8]">
              {data.mood}
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-[#22C55E]">
          {data.key_facts.length} facts
        </span>
      </div>
      <p className="mb-3 text-[13px] leading-relaxed text-[#CBD5E1]">
        {data.summary}
      </p>
      {data.key_facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {facts.map((fact, i) => (
            <span
              key={i}
              className="rounded-md bg-[#0F172A] px-2 py-1 text-[11px] text-[#94A3B8]"
            >
              {fact}
            </span>
          ))}
          {data.key_facts.length > 5 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded-md bg-[#0F172A] px-2 py-1 text-[11px] text-primary hover:text-primary/80"
            >
              {expanded ? "Show less" : `+${data.key_facts.length - 5} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MusicStatusCard({ info }: { info: MusicInfo }) {
  return (
    <div className="rounded-[10px] border border-[#334155] bg-[#1E293B] px-4 py-2.5 flex items-center gap-2">
      {info.status === "generating" && (
        <>
          <div className="size-3 animate-spin rounded-full border-2 border-[#334155] border-t-[#A78BFA]" />
          <span className="text-[11px] text-[#94A3B8]">
            Generating music via {info.provider ?? "AI"}...
          </span>
        </>
      )}
      {info.status === "generated" && (
        <>
          <span className="size-2 rounded-full bg-[#22C55E]" />
          <span className="text-[11px] text-[#94A3B8]">
            Music generated via {info.provider ?? "AI"}
          </span>
        </>
      )}
      {info.status === "fallback" && (
        <>
          <span className="size-2 rounded-full bg-[#F59E0B]" />
          <span className="text-[11px] text-[#94A3B8]">
            Using bundled track{info.reason ? ` (${info.reason})` : ""}
          </span>
        </>
      )}
    </div>
  );
}

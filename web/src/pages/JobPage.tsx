import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StageCard } from "@/components/StageCard";
import { api, type JobSummary } from "@/hooks/useApi";
import { useSSE } from "@/hooks/useSSE";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Plus,
  Loader2,
  AlertTriangle,
  Play,
  RotateCcw,
  Clock,
  DollarSign,
  Layers,
} from "lucide-react";

const STAGES = ["research", "director", "tts", "visuals", "assembly", "critic"] as const;

const STAGE_FRIENDLY: Record<string, string> = {
  research: "Research",
  director: "Creative Director",
  tts: "Voice Synthesis",
  visuals: "Visual Assets",
  assembly: "Assembly & Render",
  critic: "Quality Review",
};

export function JobPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobSummary | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getJob(id)
      .then(setJob)
      .catch((err) => setError(err.message));
  }, [id]);

  const handleSSEEvent = useCallback(
    ({ event, data }: { event: string; data: unknown }) => {
      const d = data as Record<string, unknown>;

      if (event === "job:snapshot") {
        setJob(d as unknown as JobSummary);
        return;
      }

      if (event === "job:completed" || event === "job:failed") {
        if (id) api.getJob(id).then(setJob).catch(() => {});
        return;
      }

      if (event.startsWith("stage:")) {
        setJob((prev) => {
          if (!prev) return prev;
          const stageName = d.stage as string;
          const type = d.type as string;
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
      if (id) api.getJob(id).then(setJob).catch(() => {});
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
  const videoUrl = job.videoPath ? `/api/v1/jobs/${job.id}/artifacts/${job.videoPath}` : null;

  // Find the failed stage for error display
  const failedStage = isFailed
    ? STAGES.find((s) => job.stages?.[s]?.status === "error")
    : null;
  const failedDetail = failedStage ? job.stages?.[failedStage]?.detail : null;

  // Compute total duration
  const totalDuration = STAGES.reduce((sum, s) => {
    const d = job.stages?.[s]?.durationSec;
    return sum + (d ?? 0);
  }, 0);

  const totalCost = job.actualCost?.totalCost ?? job.costEstimate?.totalCost;
  const sceneCount = job.stages?.director?.detail?.match(/(\d+)\s*scene/i)?.[1] ?? null;

  // Gather script / detail info for tabs
  const directorDetail = job.stages?.director?.detail;
  const researchDetail = job.stages?.research?.detail;

  return (
    <div className="py-8 px-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold">{job.topic}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {job.archetype && (
              <Badge variant="secondary" className="rounded-md border-0 bg-[#6366F120] px-2.5 py-1 text-xs font-normal text-primary">
                {job.archetype
                  .split(/[-_]/)
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")}
              </Badge>
            )}
            <span className="text-xs text-[#64748B]">YouTube Shorts</span>
            {totalCost != null && (
              <>
                <span className="text-xs text-[#475569]">·</span>
                <span className="text-xs text-[#64748B]">
                  ~${totalCost.toFixed(2)} {job.actualCost ? "total" : "estimated"}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#334155] bg-[#1E293B] px-3.5 py-1.5">
              <div className="size-2 rounded-full bg-[#22D3EE]" />
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

          {isRunning && (
            <Button variant="outline" size="sm" className="rounded-lg border-[#334155] px-3.5 py-1.5 text-[13px] font-medium text-[#64748B]" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel"}
            </Button>
          )}
          {isFailed && (
            <Button size="sm" className="gap-2 rounded-lg px-4 py-2">
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          )}
          {isCompleted && videoUrl && (
            <Button size="sm" className="gap-2 rounded-lg px-4 py-2" render={<a href={videoUrl} download />}>
              <Download className="size-3.5" />
              Download
            </Button>
          )}
          {!isRunning && (
            <Button variant="outline" size="sm" className="rounded-lg border-[#334155] px-4 py-2 text-[13px] font-medium text-[#94A3B8]" onClick={() => navigate("/")}>
              <Plus className="size-3.5" />
              New Short
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex items-start gap-7">
        {/* Left: Pipeline Timeline */}
        <div className="w-[300px] shrink-0">
          {STAGES.map((stage, i) => {
            const stageData = job.stages?.[stage];
            return (
              <StageCard
                key={stage}
                name={stage}
                status={(stageData?.status as "pending") ?? "pending"}
                detail={stageData?.detail}
                durationSec={stageData?.durationSec}
                isLast={i === STAGES.length - 1}
              />
            );
          })}
        </div>

        {/* Right: Content Area */}
        <div className="flex-1">
          {/* Failed state — show error card prominently, no tabs */}
          {isFailed && (
            <div className="flex items-center justify-center h-full">
              <div className="w-[480px] rounded-[14px] border border-[#EF444430] bg-[#1E293B] p-8 flex flex-col items-center text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-[#EF444415]">
                  <AlertTriangle className="size-6 text-destructive" />
                </div>
                <h2 className="text-lg font-semibold text-[#F1F5F9]">
                  Pipeline Failed at {failedStage ? STAGE_FRIENDLY[failedStage] ?? failedStage : "Unknown Stage"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]" style={{ maxWidth: 380 }}>
                  {failedDetail
                    ? "The image generation API returned a rate limit error. This usually resolves after a few minutes."
                    : "The pipeline encountered an error. This usually resolves after a few minutes."}
                </p>

                {failedDetail && (
                  <div className="mt-4 w-full max-w-md">
                    <p className="mb-1.5 text-left text-xs text-muted-foreground">Error Details</p>
                    <div className="rounded-lg bg-muted/50 p-3 text-left">
                      <code className="text-xs text-destructive/80">{failedDetail}</code>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <Button size="sm" className="gap-1.5">
                    <RotateCcw className="size-3.5" />
                    Retry from failed stage
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                    Start over
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Completed — video player + stats */}
          {isCompleted && (
            <div className="space-y-6">
              <div className="w-[340px] overflow-hidden rounded-xl border border-[#334155] bg-[#0D1526]" style={{ borderRadius: 12 }}>
                {videoUrl ? (
                  <div className="flex aspect-[9/16] max-h-[500px] items-center justify-center bg-black/50">
                    <video src={videoUrl} controls className="h-full w-auto" playsInline>
                      <track kind="captions" />
                    </video>
                  </div>
                ) : (
                  <div className="flex aspect-[9/16] max-h-[500px] flex-col items-center justify-center gap-3 bg-card">
                    <Play className="size-12 text-primary/50" />
                    <span className="text-sm text-muted-foreground">
                      {job.videoPath ?? "Video not available"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-8">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1.5 text-lg font-semibold">
                    <Clock className="size-4 text-muted-foreground" />
                    {totalDuration.toFixed(1)}s
                  </div>
                  <span className="text-[11px] text-muted-foreground">Total time</span>
                </div>
                {totalCost != null && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1.5 text-lg font-semibold">
                      <DollarSign className="size-4 text-muted-foreground" />
                      {totalCost.toFixed(2)}
                    </div>
                    <span className="text-[11px] text-muted-foreground">Total cost</span>
                  </div>
                )}
                {sceneCount && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1.5 text-lg font-semibold">
                      <Layers className="size-4 text-muted-foreground" />
                      {sceneCount}
                    </div>
                    <span className="text-[11px] text-muted-foreground">Scenes</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Running or queued — show tabs with live content */}
          {(isRunning || (!isCompleted && !isFailed)) && (
            <Tabs defaultValue="script">
              <TabsList className="h-auto gap-0 rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="script"
                  className="rounded-t-[8px] rounded-b-none border-0 px-5 py-2.5 text-sm font-medium text-muted-foreground data-active:bg-[#1E293B] data-active:text-foreground"
                >
                  Script
                </TabsTrigger>
                <TabsTrigger
                  value="visuals"
                  className="rounded-t-[8px] rounded-b-none border-0 px-5 py-2.5 text-sm font-medium text-muted-foreground data-active:bg-[#1E293B] data-active:text-foreground"
                >
                  Visuals
                </TabsTrigger>
                <TabsTrigger
                  value="audio"
                  className="rounded-t-[8px] rounded-b-none border-0 px-5 py-2.5 text-sm font-medium text-muted-foreground data-active:bg-[#1E293B] data-active:text-foreground"
                >
                  Audio
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="rounded-t-[8px] rounded-b-none border-0 px-5 py-2.5 text-sm font-medium text-muted-foreground data-active:bg-[#1E293B] data-active:text-foreground"
                >
                  Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="script">
                <div className="rounded-[10px] rounded-tl-none border border-[#334155] bg-[#1E293B] p-6">
                  {directorDetail ? (
                    <div className="space-y-5">
                      <div>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Director Output
                        </span>
                        <p className="text-sm leading-relaxed text-foreground/80">
                          {directorDetail}
                        </p>
                      </div>
                    </div>
                  ) : researchDetail ? (
                    <div>
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Research Summary
                      </span>
                      <p className="text-sm leading-relaxed text-foreground/80">
                        {researchDetail}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Script will appear here once the Creative Director stage completes...
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="visuals">
                <div className="rounded-[10px] rounded-tl-none border border-[#334155] bg-[#1E293B] p-6">
                  <p className="text-sm text-muted-foreground">
                    Visual assets will appear here...
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="audio">
                <div className="rounded-[10px] rounded-tl-none border border-[#334155] bg-[#1E293B] p-6">
                  <p className="text-sm text-muted-foreground">
                    Audio tracks will appear here...
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="preview">
                <div className="rounded-[10px] rounded-tl-none border border-[#334155] bg-[#1E293B] p-6">
                  <p className="text-sm text-muted-foreground">
                    Preview will be available once rendering completes...
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

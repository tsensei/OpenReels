import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type JobSummary } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Play, AlertTriangle, Film, Plus, Loader2 } from "lucide-react";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

const ARCHETYPE_COLORS: Record<string, string> = {
  "studio-realism": "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  "warm-editorial": "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "anime-illustration": "bg-pink-500/15 text-pink-400 border-pink-500/20",
  "cinematic-noir": "bg-slate-500/15 text-slate-400 border-slate-500/20",
  "pop-art": "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  "watercolor-dream": "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "warm-narrative": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "cinematic-documentary": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "retro-nostalgia": "bg-rose-500/15 text-rose-400 border-rose-500/20",
  "minimal-modern": "bg-gray-500/15 text-gray-400 border-gray-500/20",
  "neon-cyberpunk": "bg-violet-500/15 text-violet-400 border-violet-500/20",
  "botanical-organic": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "horror-dark": "bg-red-500/15 text-red-400 border-red-500/20",
  "comic-strip": "bg-lime-500/15 text-lime-400 border-lime-500/20",
};

export function GalleryPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    try {
      const result = await api.listJobs();
      setJobs(result.jobs);
      setTotal(result.total);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="py-8 px-10">
        <h1 className="mb-6 text-2xl font-bold">Gallery</h1>
        <div className="flex flex-1 flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 160px)" }}>
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-[#1E293B]">
              <Film className="size-9 text-[#334155]" />
            </div>
            <h2 className="text-xl font-semibold text-[#E2E8F0]">No videos yet</h2>
            <p className="mt-2 text-sm text-[#64748B]">
              Create your first Short and it will appear here.
            </p>
            <Button className="mt-5 gap-2 rounded-[10px] px-6 py-2.5" onClick={() => navigate("/")}>
              <Plus className="size-4" />
              Create a Short
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gallery</h1>
        <span className="text-[13px] text-[#64748B]">
          {total} video{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {jobs.map((job) => {
          const isFailed = job.status === "failed";
          const archetypeKey = job.archetype?.toLowerCase().replace(/[\s_]+/g, "-") ?? "";
          const archetypeColor =
            ARCHETYPE_COLORS[archetypeKey] ??
            "bg-secondary text-secondary-foreground";

          return (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className={cn(
                "group overflow-hidden rounded-[12px] border bg-[#1E293B] transition-all hover:border-primary/30",
                isFailed ? "border-[#EF444430]" : "border-[#334155]"
              )}
            >
              {/* Thumbnail */}
              <div
                className="flex h-[180px] items-center justify-center bg-[#12192D]"
              >
                {isFailed ? (
                  <AlertTriangle className="size-8 text-destructive" />
                ) : (
                  <Play className="size-8 text-primary transition-colors group-hover:text-primary/50" />
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="truncate text-sm font-semibold text-[#E2E8F0]">{job.topic}</h3>
                <div className="mt-2 flex items-center gap-2">
                  {job.archetype && (
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] font-normal border", archetypeColor)}
                    >
                      {job.archetype
                        .split(/[-_]/)
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ")}
                    </Badge>
                  )}
                  {isFailed && (
                    <Badge variant="destructive" className="text-[10px] font-normal">
                      Failed
                    </Badge>
                  )}
                  {job.createdAt && (
                    <span className="text-[11px] text-muted-foreground">
                      {timeAgo(job.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

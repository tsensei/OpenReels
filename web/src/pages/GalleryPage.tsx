import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Archetype, type JobSummary } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { GalleryCard } from "@/components/GalleryCard";
import {
  GalleryToolbar,
  type SortBy,
  type StatusFilter,
  type ViewMode,
} from "@/components/GalleryToolbar";
import { cn, formatArchetypeName } from "@/lib/utils";
import {
  Film,
  Plus,
  Loader2,
  Trash2,
  X,
  Clock,
  DollarSign,
  Star,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 20;
const VIEW_MODE_KEY = "openreels_gallery_view";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function GalleryPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Toolbar state
  const [searchQuery, setSearchQuery] = useState("");
  const [archetypeFilter, setArchetypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "grid";
  });

  // Archetype list for filter dropdown
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const bulkMode = selectedIds.size > 0;

  useEffect(() => {
    api.listArchetypes().then(setArchetypes).catch(() => {});
  }, []);

  const loadJobs = useCallback(async (append = false) => {
    try {
      const currentOffset = append ? offset + PAGE_SIZE : 0;
      const result = await api.listJobs(PAGE_SIZE, currentOffset);
      if (append) {
        setJobs((prev) => [...prev, ...result.jobs]);
        setOffset(currentOffset);
      } else {
        setJobs(result.jobs);
        setOffset(0);
      }
      setTotal(result.total);
    } catch {}
    setLoading(false);
    setLoadingMore(false);
  }, [offset]);

  useEffect(() => {
    loadJobs();
  }, []);

  const handleLoadMore = () => {
    setLoadingMore(true);
    loadJobs(true);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const toggleSelect = (jobId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await api.deleteJob(id);
      } catch {}
    }
    setSelectedIds(new Set());
    setDeleteDialogOpen(false);
    setDeleting(false);
    // Reload
    setLoading(true);
    loadJobs();
  };

  // Client-side filter + sort
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((j) => j.topic.toLowerCase().includes(q));
    }

    // Archetype filter
    if (archetypeFilter !== "all") {
      result = result.filter((j) => j.archetype === archetypeFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "running") {
        result = result.filter((j) => j.status === "running" || j.status === "queued");
      } else {
        result = result.filter((j) => j.status === statusFilter);
      }
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
        case "cost": {
          const costA = a.actualCost?.totalCost ?? a.costEstimate?.totalCost ?? 0;
          const costB = b.actualCost?.totalCost ?? b.costEstimate?.totalCost ?? 0;
          return costB - costA;
        }
        case "score": {
          const scoreA = a.criticReview?.score ?? 0;
          const scoreB = b.criticReview?.score ?? 0;
          return scoreB - scoreA;
        }
        default: // newest
          return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      }
    });

    return result;
  }, [jobs, searchQuery, archetypeFilter, statusFilter, sortBy]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="py-8 px-4 sm:px-10">
        <h1 className="mb-6 text-2xl font-bold">Gallery</h1>
        <div
          className="flex flex-1 flex-col items-center justify-center"
          style={{ minHeight: "calc(100vh - 160px)" }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-[#1E293B]">
              <Film className="size-9 text-[#334155]" />
            </div>
            <h2 className="text-xl font-semibold text-[#E2E8F0]">No videos yet</h2>
            <p className="mt-2 text-sm text-[#64748B]">
              Create your first Short and it will appear here.
            </p>
            <Button
              className="mt-5 gap-2 rounded-[10px] px-6 py-2.5"
              onClick={() => navigate("/")}
            >
              <Plus className="size-4" />
              Create a Short
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const hasMore = jobs.length < total;

  return (
    <div className="py-8 px-4 sm:px-10">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gallery</h1>
        <span className="text-[13px] text-[#64748B]">
          {filteredJobs.length} of {total} video{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Toolbar */}
      <div className="mb-5">
        <GalleryToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          archetypeFilter={archetypeFilter}
          onArchetypeChange={setArchetypeFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          archetypes={archetypes}
        />
      </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 rounded-lg"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-[#94A3B8]"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="size-3.5" />
            Deselect
          </Button>
        </div>
      )}

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-[#64748B]">No videos match your filters.</p>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid view */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredJobs.map((job) => (
            <GalleryCard
              key={job.id}
              job={job}
              bulkMode={bulkMode}
              selected={selectedIds.has(job.id)}
              onToggleSelect={() => toggleSelect(job.id)}
              timeAgo={job.createdAt ? timeAgo(job.createdAt) : ""}
            />
          ))}
        </div>
      ) : (
        /* List view */
        <div className="flex flex-col gap-2">
          {filteredJobs.map((job) => (
            <ListCard
              key={job.id}
              job={job}
              bulkMode={bulkMode}
              selected={selectedIds.has(job.id)}
              onToggleSelect={() => toggleSelect(job.id)}
              timeAgo={job.createdAt ? timeAgo(job.createdAt) : ""}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            className="rounded-lg border-[#334155] px-6"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Load more (${jobs.length} of ${total})`
            )}
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} video{selectedIds.size > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected videos and their artifacts. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── List view card ─── */

function ListCard({
  job,
  bulkMode,
  selected,
  onToggleSelect,
  timeAgo: timeAgoStr,
}: {
  job: JobSummary;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  timeAgo: string;
}) {
  const isFailed = job.status === "failed";
  const isRunning = job.status === "running" || job.status === "queued";
  const score = job.score as { scenes?: { length: number }[] } | undefined;
  const sceneCount = score?.scenes?.length;
  const criticScore = job.criticReview?.score;
  const cost = job.actualCost?.totalCost ?? job.costEstimate?.totalCost;

  return (
    <a
      href={`/jobs/${job.id}`}
      onClick={(e) => {
        if (bulkMode) {
          e.preventDefault();
          onToggleSelect();
        }
      }}
      className={cn(
        "flex items-center gap-4 rounded-lg border bg-[#1E293B] px-4 py-3 transition-all hover:border-primary/30",
        isFailed ? "border-[#EF444430]" : "border-[#334155]",
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
    >
      {bulkMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="shrink-0"
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#E2E8F0]">{job.topic}</p>
        <div className="mt-1 flex items-center gap-2">
          {job.archetype && (
            <span className="text-[10px] text-[#64748B]">
              {formatArchetypeName(job.archetype)}
            </span>
          )}
          {isFailed && (
            <Badge variant="destructive" className="text-[9px] font-normal py-0">
              Failed
            </Badge>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-[#22D3EE]">
              <span className="size-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
              Running
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-[11px] text-[#64748B]">
        {sceneCount != null && (
          <span className="flex items-center gap-1">
            <Layers className="size-3" />
            {sceneCount}
          </span>
        )}
        {cost != null && (
          <span className="flex items-center gap-1">
            <DollarSign className="size-3" />
            ${cost.toFixed(2)}
          </span>
        )}
        {criticScore != null && (
          <span className="flex items-center gap-1">
            <Star className="size-3" />
            {criticScore}
          </span>
        )}
        <span className="flex items-center gap-1 w-16 justify-end">
          <Clock className="size-3" />
          {timeAgoStr}
        </span>
      </div>
    </a>
  );
}

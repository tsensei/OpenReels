import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, LayoutGrid, List } from "lucide-react";
import { cn, formatArchetypeName } from "@/lib/utils";
import type { Archetype } from "@/hooks/useApi";

export type SortBy = "newest" | "oldest" | "cost" | "score";
export type StatusFilter = "all" | "completed" | "failed" | "running";
export type ViewMode = "grid" | "list";

interface GalleryToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  archetypeFilter: string;
  onArchetypeChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  sortBy: SortBy;
  onSortChange: (value: SortBy) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  archetypes: Archetype[];
}

export function GalleryToolbar({
  searchQuery,
  onSearchChange,
  archetypeFilter,
  onArchetypeChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  archetypes,
}: GalleryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#64748B]" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search topics..."
          className="h-9 rounded-lg border-[#334155] bg-[#0F172A] pl-9 text-sm text-foreground placeholder:text-[#475569]"
        />
      </div>

      {/* Archetype filter */}
      <Select value={archetypeFilter} onValueChange={(v) => v && onArchetypeChange(v)}>
        <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-lg border-[#334155] bg-[#0F172A] text-xs">
          <SelectValue placeholder="All Styles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Styles</SelectItem>
          {archetypes.map((a) => (
            <SelectItem key={a.name} value={a.name}>
              {formatArchetypeName(a.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={statusFilter}
        onValueChange={(v) => onStatusChange(v as StatusFilter)}
      >
        <SelectTrigger className="h-9 w-auto min-w-[110px] rounded-lg border-[#334155] bg-[#0F172A] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="running">Running</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortBy)}>
        <SelectTrigger className="h-9 w-auto min-w-[100px] rounded-lg border-[#334155] bg-[#0F172A] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="cost">Highest Cost</SelectItem>
          <SelectItem value="score">Highest Score</SelectItem>
        </SelectContent>
      </Select>

      {/* View toggle */}
      <div className="flex rounded-lg border border-[#334155] overflow-hidden">
        <button
          type="button"
          onClick={() => onViewModeChange("grid")}
          className={cn(
            "flex items-center justify-center size-9 transition-colors",
            viewMode === "grid" ? "bg-primary/15 text-primary" : "text-[#64748B] hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("list")}
          className={cn(
            "flex items-center justify-center size-9 border-l border-[#334155] transition-colors",
            viewMode === "list" ? "bg-primary/15 text-primary" : "text-[#64748B] hover:text-foreground",
          )}
        >
          <List className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

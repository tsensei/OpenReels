import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PlusCircle, LayoutGrid, Settings } from "lucide-react";
import type { StatsResponse } from "@/hooks/useApi";

const NAV_ITEMS = [
  { path: "/", label: "New", icon: PlusCircle },
  { path: "/gallery", label: "Gallery", icon: LayoutGrid },
  { path: "/settings", label: "Settings", icon: Settings },
];

interface BottomNavProps {
  stats: StatsResponse | null;
}

export function BottomNav({ stats }: BottomNavProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/")
      return location.pathname === "/" || location.pathname.startsWith("/jobs");
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-[#1E293B] bg-sidebar/95 backdrop-blur-md">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-1 relative",
              active
                ? "text-primary"
                : "text-[#64748B] hover:text-foreground",
            )}
          >
            <item.icon className="size-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
            {/* Active job pulse */}
            {item.path === "/" && stats && stats.activeJobs > 0 && (
              <span className="absolute top-0.5 right-2 size-2 rounded-full bg-[#22D3EE] animate-pulse" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { api, type StatsResponse } from "@/hooks/useApi";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

const COLLAPSED_KEY = "openreels_sidebar_collapsed";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function Layout() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  });
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Fetch stats on mount and poll every 30s
  useEffect(() => {
    let active = true;
    const load = () => {
      api
        .getStats()
        .then((s) => { if (active) setStats(s); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!isDesktop) {
    return (
      <div className="flex min-h-screen flex-col pb-14">
        <main className="flex-1">
          <Outlet />
        </main>
        <BottomNav stats={stats} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        stats={stats}
      />

      {/* Main content */}
      <main
        className={cn(
          "flex-1 transition-[margin-left] duration-200",
          collapsed ? "ml-16" : "ml-[240px]",
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}

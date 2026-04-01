import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Clapperboard, PlusCircle, LayoutGrid, Settings } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "New Short", icon: PlusCircle },
  { path: "/gallery", label: "Gallery", icon: LayoutGrid },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" || location.pathname.startsWith("/jobs");
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col bg-sidebar">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 pt-8 pb-0">
          <Clapperboard className="size-6 text-primary" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            OpenReels
          </span>
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex flex-col gap-1 px-5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="fixed inset-y-0 left-[240px] z-30 w-px bg-[#1E293B]" />

      {/* Main content */}
      <main className="ml-[240px] flex-1">
        <Outlet />
      </main>
    </div>
  );
}

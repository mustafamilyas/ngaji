"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AppSidebar, BrandMark, SidebarNav } from "@/components/app-sidebar";
import type { SessionUser } from "@/lib/auth/session-user";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * App frame: the viewport is fixed (`h-dvh`) and only `<main>` scrolls, so the
 * sidebar (desktop) and top bar (mobile) never scroll away with long content.
 */
export function NavShell({
  children,
  user,
  initialCollapsed = false,
}: {
  children: React.ReactNode;
  user?: Pick<SessionUser, "name" | "role">;
  initialCollapsed?: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleCollapsed();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  if (!user) {
    return <div className="min-h-dvh bg-background px-4 py-6">{children}</div>;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar
        userName={user.name}
        userRole={user.role}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 lg:hidden">
          <BrandMark />
          <button
            type="button"
            aria-label="Buka menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
          >
            <Menu className="size-5" />
          </button>
        </header>

        {/* scroll-padding matches the content padding so Next's scroll-into-view on navigation lands at the very top. */}
        <main className="min-w-0 flex-1 scroll-pt-6 overflow-y-auto overscroll-contain lg:scroll-pt-8">
          <div className="px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      {/* Mobile drawer: slides over the content instead of pushing it down. */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-200",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <nav
          id="mobile-nav"
          aria-label="Menu utama"
          inert={!drawerOpen}
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-card px-3 py-4 shadow-xl transition-transform duration-200",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between">
            <BrandMark />
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
            >
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav userName={user.name} userRole={user.role} onNavigate={() => setDrawerOpen(false)} />
        </nav>
      </div>
    </div>
  );
}

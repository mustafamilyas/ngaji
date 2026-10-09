"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/app/dashboard-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NAV_ITEMS } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/grup": Network,
  "/anggota": Users,
  "/kegiatan": CalendarDays,
  "/statistik": BarChart3,
  "/pengguna": UserCog,
  "/audit": ScrollText,
};

export function BrandMark({ withLabel = true }: { withLabel?: boolean }) {
  return (
    <Link href="/" aria-label="Ngaji" className="flex items-center gap-2 px-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
        N
      </span>
      {withLabel && <span className="font-heading text-lg font-semibold">Ngaji</span>}
    </Link>
  );
}

/** Nav links, general section, and user card shared by the docked sidebar and the mobile drawer. */
export function SidebarNav({
  userName,
  userRole,
  onNavigate,
  collapsed = false,
}: {
  userName: string;
  userRole: string;
  onNavigate?: () => void;
  /** Icon-only rail (desktop "minimize"); labels move to tooltips. */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const itemClass = cn(
    "flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors",
    collapsed ? "justify-center px-0" : "px-2.5",
  );

  return (
    <>
      <nav className="flex flex-col gap-1">
        <SectionLabel collapsed={collapsed}>MENU</SectionLabel>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.href] ?? LayoutDashboard;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    itemClass,
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="flex flex-col gap-1">
        <SectionLabel collapsed={collapsed}>UMUM</SectionLabel>
        <ul className="flex flex-col gap-0.5">
          <li>
            <Link
              href="/akun/password"
              onClick={onNavigate}
              title={collapsed ? "Pengaturan" : undefined}
              aria-label={collapsed ? "Pengaturan" : undefined}
              className={cn(itemClass, "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <Settings className="size-4 shrink-0" />
              {!collapsed && "Pengaturan"}
            </Link>
          </li>
          <li>
            <form action={signOutAction}>
              <button
                type="submit"
                title={collapsed ? "Keluar" : undefined}
                aria-label={collapsed ? "Keluar" : undefined}
                className={cn(itemClass, "w-full text-left text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <LogOut className="size-4 shrink-0" />
                {!collapsed && "Keluar"}
              </button>
            </form>
          </li>
        </ul>
      </nav>

      <div
        title={collapsed ? `${userName} · ${userRole}` : undefined}
        className={cn(
          "mt-auto flex items-center gap-2 rounded-lg",
          collapsed ? "justify-center" : "border px-2.5 py-2",
        )}
      >
        <Avatar>
          <AvatarFallback>{initials(userName)}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userRole}</p>
          </div>
        )}
      </div>
    </>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (collapsed) return <div aria-hidden className="mx-auto my-1.5 h-px w-6 bg-border" />;
  return <p className="px-2.5 text-xs font-medium text-muted-foreground">{children}</p>;
}

/** Docked left sidebar, visible on every page at `lg` and up; collapsible to an icon rail. */
export function AppSidebar({
  userName,
  userRole,
  collapsed,
  onToggleCollapsed,
}: {
  userName: string;
  userRole: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const toggleLabel = collapsed ? "Perluas menu" : "Perkecil menu";
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col gap-6 overflow-y-auto border-r bg-card py-5 transition-[width] duration-200 lg:flex",
        collapsed ? "w-16 px-2" : "w-60 px-3",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "justify-between")}>
        <BrandMark withLabel={!collapsed} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={`${toggleLabel} (Ctrl/⌘+B)`}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
      <SidebarNav userName={userName} userRole={userRole} collapsed={collapsed} />
    </aside>
  );
}

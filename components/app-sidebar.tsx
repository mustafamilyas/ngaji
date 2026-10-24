"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/app/dashboard/actions";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DASHBOARD_PATH, NAV_ITEMS } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  [DASHBOARD_PATH]: LayoutDashboard,
  "/dashboard/grup": Network,
  "/dashboard/anggota": Users,
  "/dashboard/tampilan": ListFilter,
  "/dashboard/kegiatan": CalendarDays,
  "/dashboard/survei": ClipboardList,
  "/dashboard/statistik": BarChart3,
  "/dashboard/pengguna": UserCog,
  "/dashboard/audit": ScrollText,
  "/dashboard/pengaturan": Settings,
};

export function BrandMark({ organizationName, withLabel = true }: { organizationName: string; withLabel?: boolean }) {
  return (
    <Link href={DASHBOARD_PATH} aria-label={organizationName} className="flex min-h-11 min-w-0 items-center gap-2 px-2">
      <Logo />
      {withLabel && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-heading text-base font-semibold">{organizationName}</span>
          <span className="text-xs text-muted-foreground">oleh Dahan</span>
        </span>
      )}
    </Link>
  );
}

/** Nav links, general section, and user card shared by the docked sidebar and the mobile drawer. */
export function SidebarNav({
  userName,
  userRole,
  isRootOwner = false,
  onNavigate,
  collapsed = false,
}: {
  userName: string;
  userRole: string;
  /** Reveals root-OWNER-only items such as "Pengaturan". */
  isRootOwner?: boolean;
  onNavigate?: () => void;
  /** Icon-only rail (desktop "minimize"); labels move to tooltips. */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const itemClass = cn(
    "flex min-h-11 items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors xl:min-h-0",
    collapsed ? "justify-center px-0" : "px-2.5",
  );

  return (
    <>
      <nav className="flex flex-col gap-1">
        <SectionLabel collapsed={collapsed}>MENU</SectionLabel>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.filter((item) => isRootOwner || !item.rootOwnerOnly).map((item) => {
            const Icon = ICONS[item.href] ?? LayoutDashboard;
            const active = item.href === DASHBOARD_PATH ? pathname === DASHBOARD_PATH : pathname.startsWith(item.href);
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
              href="/dashboard/akun/password"
              onClick={onNavigate}
              title={collapsed ? "Akun" : undefined}
              aria-label={collapsed ? "Akun" : undefined}
              className={cn(itemClass, "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <UserRound className="size-4 shrink-0" />
              {!collapsed && "Akun"}
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
  organizationName,
  userName,
  userRole,
  isRootOwner,
  collapsed,
  onToggleCollapsed,
}: {
  organizationName: string;
  userName: string;
  userRole: string;
  isRootOwner?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const toggleLabel = collapsed ? "Perluas menu" : "Perkecil menu";
  return (
    <aside
      className={cn(
        // Scrollbar hidden so the 64px rail keeps its full 48px tap width; the sidebar still scrolls on short screens.
        "hidden shrink-0 flex-col gap-6 overflow-y-auto border-r bg-card py-5 transition-[width] duration-200 [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden",
        collapsed ? "w-16 px-2" : "w-60 px-3",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "justify-between")}>
        <BrandMark organizationName={organizationName} withLabel={!collapsed} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={`${toggleLabel} (Ctrl/⌘+B)`}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground xl:size-8"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
      <SidebarNav userName={userName} userRole={userRole} isRootOwner={isRootOwner} collapsed={collapsed} />
    </aside>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
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
import { hasMoreBelow } from "@/components/nav-scroll";
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

/** `collapsed` hides the label from `xl` only: the icon rail exists on desktop widths, not on tablets. */
export function BrandMark({ organizationName, collapsed = false }: { organizationName: string; collapsed?: boolean }) {
  return (
    <Link href={DASHBOARD_PATH} aria-label={organizationName} className="flex min-h-11 min-w-0 items-center gap-2 px-2">
      <Logo />
      <span className={cn("flex min-w-0", collapsed && "xl:hidden")}>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-heading text-base font-semibold">{organizationName}</span>
          <span className="text-xs text-muted-foreground">oleh Dahan</span>
        </span>
      </span>
    </Link>
  );
}

/**
 * Nav links, general section, and user card shared by the docked sidebar and the mobile drawer.
 * `collapsed` is the icon rail, which only exists from `xl` (desktop widths, where `title` tooltips work):
 * below that every label stays visible, so a tablet never shows unlabeled icons.
 */
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
  /** Icon-only rail from `xl`; labels move to tooltips there. */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  // The menu list scrolls on short screens with its scrollbar hidden, so a fade at its bottom edge says there is more.
  // The observer reports once when it starts, and again when the list is resized (a phone rotated).
  useEffect(() => {
    const list = menuRef.current;
    if (!list) return;
    const update = () => setMoreBelow(hasMoreBelow(list));
    list.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);

  const itemClass = cn(
    "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors xl:min-h-0",
    collapsed && "xl:justify-center xl:px-0",
  );
  const label = (text: string) => <span className={cn(collapsed && "xl:hidden")}>{text}</span>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [@media(max-height:500px)]:gap-2">
      {/* Only the menu list scrolls; Akun, Keluar and the user card stay pinned below it (short and landscape screens). */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <nav
          ref={menuRef}
          data-nav-scroll="menu"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
                    {label(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {moreBelow && (
          <div
            data-nav-fade
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-card to-transparent"
          />
        )}
      </div>

      <div data-nav-footer className="flex shrink-0 flex-col gap-3 [@media(max-height:500px)]:gap-1">
        <nav className="flex flex-col gap-1">
          <SectionLabel collapsed={collapsed} className="[@media(max-height:500px)]:hidden">
            UMUM
          </SectionLabel>
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
                {label("Akun")}
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
                  {label("Keluar")}
                </button>
              </form>
            </li>
          </ul>
        </nav>

        {/* Under 500px of height (a landscape phone) the card below is hidden to save room; this one line stands in for it. */}
        <p
          className={cn(
            "hidden truncate px-2.5 text-xs text-muted-foreground [@media(max-height:500px)]:block",
            collapsed && "xl:hidden",
          )}
        >
          {`${userName} · ${userRole}`}
        </p>
        <div
          title={collapsed ? `${userName} · ${userRole}` : undefined}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-2.5 py-2 [@media(max-height:500px)]:hidden",
            collapsed && "xl:justify-center xl:border-0 xl:p-0",
          )}
        >
          <Avatar>
            <AvatarFallback>{initials(userName)}</AvatarFallback>
          </Avatar>
          <div className={cn("min-w-0", collapsed && "xl:hidden")}>
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userRole}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ collapsed, className, children }: { collapsed: boolean; className?: string; children: React.ReactNode }) {
  if (!collapsed) return <p className={cn("px-2.5 text-xs font-medium text-muted-foreground", className)}>{children}</p>;
  return (
    <>
      <p className={cn("px-2.5 text-xs font-medium text-muted-foreground xl:hidden", className)}>{children}</p>
      <div aria-hidden className={cn("mx-auto my-1.5 hidden h-px w-6 bg-border xl:block", className)} />
    </>
  );
}

/** Docked left sidebar, visible on every page at `lg` and up; from `xl` it collapses to an icon rail. */
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
        // The menu list inside SidebarNav scrolls (scrollbar hidden so the 64px rail keeps its 48px tap width); the rest is pinned.
        // The rail is for `xl` and up only; a tablet always gets the full sidebar (task 10.24).
        "hidden shrink-0 flex-col gap-6 border-r bg-card py-5 transition-[width] duration-200 lg:flex",
        collapsed ? "w-60 px-3 xl:w-16 xl:px-2" : "w-60 px-3",
      )}
    >
      <div className={cn("flex items-center justify-between", collapsed && "xl:flex-col xl:justify-start xl:gap-3")}>
        <BrandMark organizationName={organizationName} collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={`${toggleLabel} (Ctrl/⌘+B)`}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          className="hidden size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground xl:inline-flex"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
      <SidebarNav userName={userName} userRole={userRole} isRootOwner={isRootOwner} collapsed={collapsed} />
    </aside>
  );
}

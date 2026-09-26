"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Network,
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
    <Link href="/" className="flex items-center gap-2 px-2">
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
}: {
  userName: string;
  userRole: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex flex-col gap-1">
        <p className="px-2.5 text-xs font-medium text-muted-foreground">MENU</p>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.href] ?? LayoutDashboard;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="flex flex-col gap-1">
        <p className="px-2.5 text-xs font-medium text-muted-foreground">UMUM</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <Link
              href="/akun/password"
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="size-4" />
              Pengaturan
            </Link>
          </li>
          <li>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-4" />
                Keluar
              </button>
            </form>
          </li>
        </ul>
      </nav>

      <div className="mt-auto flex items-center gap-2 rounded-lg border px-2.5 py-2">
        <Avatar>
          <AvatarFallback>{initials(userName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="truncate text-xs text-muted-foreground">{userRole}</p>
        </div>
      </div>
    </>
  );
}

/** Docked left sidebar, visible on every page at `lg` and up. */
export function AppSidebar({ userName, userRole }: { userName: string; userRole: string }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-card px-3 py-5 lg:flex">
      <BrandMark />
      <SidebarNav userName={userName} userRole={userRole} />
    </aside>
  );
}

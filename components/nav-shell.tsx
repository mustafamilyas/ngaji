"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session-user";

export function NavShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: Pick<SessionUser, "name" | "role">;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isDashboard = pathname === "/";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4">
        <Link href="/" className="font-semibold" onClick={() => setOpen(false)}>
          Ngaji
        </Link>
        <button
          type="button"
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted sm:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>

      {open && (
        <nav className="border-b bg-background px-2 py-2 sm:hidden">
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-md px-3 py-2.5 text-sm font-medium",
                      active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div className={cn("hidden border-b bg-background px-4 sm:block", isDashboard && "lg:hidden")}>
        <ul className="flex h-12 items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm font-medium",
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {isDashboard ? (
        <div className="flex">
          <DashboardSidebar userName={user?.name ?? ""} userRole={user?.role ?? ""} />
          <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      ) : (
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      )}
    </div>
  );
}

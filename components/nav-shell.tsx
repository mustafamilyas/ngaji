"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AppSidebar, BrandMark, SidebarNav } from "@/components/app-sidebar";
import type { SessionUser } from "@/lib/auth/session-user";

export function NavShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: Pick<SessionUser, "name" | "role">;
}) {
  const [open, setOpen] = useState(false);

  if (!user) {
    return <div className="min-h-screen bg-background px-4 py-6">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar userName={user.name} userRole={user.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden">
          <BrandMark withLabel={false} />
          <button
            type="button"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>

        {open && (
          <nav className="flex flex-col gap-6 border-b bg-background px-3 py-4 lg:hidden">
            <SidebarNav userName={user.name} userRole={user.role} onNavigate={() => setOpen(false)} />
          </nav>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

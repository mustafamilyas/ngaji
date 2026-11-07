import { cookies } from "next/headers";
import { auth } from "@/auth";
import { NavShell } from "@/components/nav-shell";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/nav";
import { getOrganization } from "@/lib/organization";

/** App frame for every signed-in route; public pages (`/`, `/login`, case studies) render without it. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";
  const organizationName = session ? (await getOrganization(session)).name : undefined;

  // `data-dashboard` scopes the phone text-size override in globals.css (kiosk included); `contents` keeps layout unchanged.
  return (
    <div data-dashboard className="contents">
      <NavShell user={session?.user} organizationName={organizationName} initialCollapsed={sidebarCollapsed}>
        {children}
      </NavShell>
    </div>
  );
}

import type { Metadata } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { getOrganizationName } from "@/lib/organization";
import { NavShell } from "@/components/nav-shell";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/nav";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "Manajemen anggota & kegiatan organisasi berjenjang";

// Public pages (no session) carry only the product name; the organization name never reaches them.
export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  if (!session) {
    return { title: { default: "Dahan", template: "%s · Dahan" }, description: DESCRIPTION };
  }
  const organizationName = await getOrganizationName();
  return {
    title: { default: `${organizationName} · Dahan`, template: `%s · ${organizationName}` },
    description: DESCRIPTION,
  };
}

// A nonce-based CSP (middleware.ts) needs a fresh nonce per request, which
// only exists for dynamically rendered pages (Next.js CSP guide) — every
// page here is session-gated already, so this reflects reality rather than
// giving up real static optimization.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";

  // Only the app shell shows the organization name; public pages never query the DB.
  const organizationName = session ? await getOrganizationName() : undefined;

  return (
    <html lang="id">
      <body
        className={`${roboto.variable} ${geistMono.variable} antialiased`}
      >
        <NavShell user={session?.user} organizationName={organizationName} initialCollapsed={sidebarCollapsed}>
          {children}
        </NavShell>
      </body>
    </html>
  );
}

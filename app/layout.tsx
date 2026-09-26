import type { Metadata } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import { auth } from "@/auth";
import { NavShell } from "@/components/nav-shell";
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

export const metadata: Metadata = {
  title: "Ngaji",
  description: "Manajemen anggota & kegiatan organisasi berjenjang",
};

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
  const session = await auth();

  return (
    <html lang="id">
      <body
        className={`${roboto.variable} ${geistMono.variable} antialiased`}
      >
        <NavShell user={session?.user}>{children}</NavShell>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavShell } from "@/components/nav-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavShell>{children}</NavShell>
      </body>
    </html>
  );
}

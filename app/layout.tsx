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

import Link from "next/link";

/**
 * Overrides Next.js's built-in not-found page (white-on-white by default,
 * English text) — used across the app for out-of-scope/soft-deleted
 * entities, never just missing routes (DESIGN.md §3.1, §4.2).
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-2 py-10">
      <h1 className="text-lg font-semibold">Tidak ditemukan</h1>
      <p className="text-sm text-muted-foreground">
        Data yang Anda cari tidak ada atau di luar akses Anda.
      </p>
      <Link href="/" className="text-sm text-primary hover:underline">
        Kembali ke dasbor
      </Link>
    </div>
  );
}

import Link from "next/link";

/**
 * Unmatched URLs outside the app frame. `/` sends signed-in users on to
 * their dashboard; in-app 404s use `app/dashboard/not-found.tsx`.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start gap-2 px-4 py-10">
      <h1 className="text-lg font-semibold">Tidak ditemukan</h1>
      <p className="text-sm text-muted-foreground">
        Data yang Anda cari tidak ada atau di luar akses Anda.
      </p>
      <Link href="/" className="text-sm text-primary hover:underline">
        Kembali ke beranda
      </Link>
    </div>
  );
}

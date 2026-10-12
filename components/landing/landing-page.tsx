import Link from "next/link";

/** Placeholder until the full landing sections are built (tasks 4.x). */
export function LandingPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="font-heading text-2xl font-semibold">Dahan</h1>
      <Link href="/login">Masuk</Link>
    </main>
  );
}

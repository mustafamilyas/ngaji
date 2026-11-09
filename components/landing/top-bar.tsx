import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const SECTIONS = [
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#keamanan", label: "Keamanan data" },
];

export function TopBar({ segmentLink }: { segmentLink: { href: string; label: string } | null }) {
  const linkClass =
    "inline-flex min-h-11 items-center rounded-full px-3 text-sm text-(--l-muted) transition-colors hover:text-(--l-ink) focus-visible:outline-2 focus-visible:outline-(--l-leaf)";
  return (
    <header className="flex items-center justify-between gap-4 py-5">
      <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-(--l-leaf)">
        <Logo className="size-9" />
        <span className="font-(family-name:--font-landing) text-xl font-semibold tracking-tight">Dahan</span>
      </Link>
      <nav aria-label="Bagian halaman" className="hidden items-center gap-1 md:flex">
        {SECTIONS.map((s) => (
          <a key={s.href} href={s.href} className={linkClass}>
            {s.label}
          </a>
        ))}
        {segmentLink && (
          <Link href={segmentLink.href} className={linkClass}>
            {segmentLink.label}
          </Link>
        )}
      </nav>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center rounded-full border border-(--l-ink)/20 bg-white px-5 text-sm font-medium transition-colors hover:bg-(--l-ink) hover:text-(--l-paper) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--l-leaf)"
      >
        Masuk
      </Link>
    </header>
  );
}

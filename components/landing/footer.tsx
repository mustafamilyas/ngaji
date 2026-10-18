import Link from "next/link";

const LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/ormas", label: "Untuk ormas" },
  { href: "/login", label: "Masuk" },
];

export function Footer() {
  return (
    <footer className="flex flex-col gap-3 py-10 text-sm text-(--l-muted) sm:flex-row sm:items-center sm:justify-between">
      <p>Dahan, manajemen anggota dan kegiatan organisasi berjenjang.</p>
      <nav aria-label="Tautan" className="flex flex-wrap gap-x-5 gap-y-1">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="py-1.5 underline-offset-4 hover:text-(--l-ink) hover:underline">
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}

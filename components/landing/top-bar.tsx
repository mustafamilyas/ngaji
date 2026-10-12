import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function TopBar() {
  return (
    <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-(--l-leaf)">
        <Logo className="size-9" />
        <span className="font-(family-name:--font-landing) text-xl font-semibold tracking-tight">Dahan</span>
      </Link>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center rounded-full border border-(--l-ink)/25 px-5 text-sm font-medium transition-colors hover:bg-(--l-ink) hover:text-(--l-paper) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--l-leaf)"
      >
        Masuk
      </Link>
    </header>
  );
}

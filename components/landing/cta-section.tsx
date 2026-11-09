import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import type { LandingContent } from "./content";

export function CtaSection({ cta }: { cta: LandingContent["cta"] }) {
  return (
    <section
      aria-labelledby="hubungi"
      className="landing-frame mt-4 flex flex-col items-center rounded-[28px] border border-(--l-ink)/8 bg-(--l-mist)/60 px-6 py-14 text-center sm:py-20"
    >
      <Logo className="size-11" />
      <h2
        id="hubungi"
        className="mt-6 max-w-lg font-(family-name:--font-landing) text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl"
      >
        {cta.title}
      </h2>
      <p className="mt-3 max-w-md leading-relaxed text-(--l-muted)">{cta.body}</p>
      <Link
        href="/daftar"
        className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-(--l-leaf) px-6 font-medium text-white transition-colors hover:bg-(--l-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--l-ink)"
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        {cta.button}
      </Link>
    </section>
  );
}

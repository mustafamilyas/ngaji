import { MessageCircle } from "lucide-react";
import type { LandingContent } from "./content";

/** Rendered only when a WhatsApp number is configured. */
export function CtaSection({ cta, href }: { cta: LandingContent["cta"]; href: string }) {
  return (
    <section aria-labelledby="hubungi" className="bg-(--l-mist) px-4 py-14 sm:px-8 lg:py-20">
      <div className="flex max-w-xl flex-col items-start gap-4">
        <h2 id="hubungi" className="font-(family-name:--font-landing) text-3xl font-bold tracking-tight text-balance">
          {cta.title}
        </h2>
        <p className="leading-relaxed text-(--l-muted)">{cta.body}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-(--l-leaf) px-6 font-medium text-white transition-colors hover:bg-(--l-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--l-ink)"
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          {cta.button}
        </a>
      </div>
    </section>
  );
}

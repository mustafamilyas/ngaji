import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { LandingContent } from "./content";
import { ActivityCard, AttendanceCard, RecapCard, TreeCard } from "./showcase-cards";

/**
 * A small tree in a 1000×680 frame: the kegiatan node (top centre) branches to the
 * upper cards, which branch to the lower ones. Lines run centre to centre; the
 * opaque cards hide the ends.
 */
const BRANCHES = [
  "M500 44 C 320 44, 125 70, 125 190",
  "M500 44 C 680 44, 875 70, 875 190",
  "M125 190 C 125 380, 150 420, 150 590",
  "M875 190 C 875 380, 850 420, 850 590",
];

export function Hero({ content, whatsappHref }: { content: LandingContent; whatsappHref: string | null }) {
  const leafLevel = content.levels[3];
  return (
    <section className="landing-frame relative isolate overflow-hidden rounded-[28px] border border-(--l-ink)/8 bg-(--l-mist)/60 px-5 pt-14 pb-8 sm:px-10 xl:min-h-[680px] xl:pt-0 xl:pb-0">
      {/* Desktop: the kegiatan node and its branches carry the "set once, applies below" idea. */}
      <svg
        viewBox="0 0 1000 680"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full xl:block"
      >
        <g fill="none" stroke="var(--l-leaf)" strokeWidth="1.5" strokeLinecap="round" opacity="0.45">
          {BRANCHES.map((d, i) => (
            <path key={d} d={d} pathLength={1} vectorEffect="non-scaling-stroke" className="landing-branch" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </g>
      </svg>
      <span
        aria-hidden="true"
        className="absolute top-[44px] left-1/2 hidden size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--l-sap) ring-8 ring-(--l-sap)/20 xl:block"
      />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center xl:max-w-[520px] xl:pt-[150px]">
        <h1 className="font-(family-name:--font-landing) text-4xl leading-[1.02] font-bold tracking-[-0.03em] text-balance sm:text-5xl xl:text-[3.25rem]">
          {content.headline}
        </h1>
        <p className="mt-5 max-w-xl text-lg xl:max-w-[470px] leading-relaxed text-pretty text-(--l-muted)">{content.lead}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-(--l-ink) px-6 font-medium text-(--l-paper) transition-colors hover:bg-(--l-leaf) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--l-leaf)"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              {content.cta.button}
            </a>
          )}
          <a
            href="#cara-kerja"
            className="inline-flex min-h-12 items-center rounded-full border border-(--l-ink)/20 bg-white/70 px-6 font-medium transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--l-leaf)"
          >
            Lihat cara kerjanya
          </a>
        </div>
        {content.segmentLink && (
          <p className="mt-5 text-sm text-(--l-muted)">
            {content.segmentLink.prompt}{" "}
            <Link
              href={content.segmentLink.href}
              className="font-medium text-(--l-leaf) underline underline-offset-4 hover:text-(--l-ink)"
            >
              {content.segmentLink.label}
            </Link>
          </p>
        )}
      </div>

      {/* Illustrative cards: in the side columns on wide screens, a short row below the text otherwise. */}
      <div aria-hidden="true" className="mt-12 grid justify-items-center gap-4 sm:grid-cols-2 xl:mt-0 xl:block">
        <ActivityCard showcase={content.showcase} leafLevel={leafLevel} className="landing-card hidden xl:absolute xl:top-[104px] xl:left-[3%] xl:block xl:w-56" />
        <TreeCard showcase={content.showcase} className="landing-card hidden xl:absolute xl:top-[104px] xl:right-[3%] xl:block xl:w-56" />
        <AttendanceCard showcase={content.showcase} className="landing-card xl:absolute xl:bottom-[-20px] xl:left-[4.5%] xl:w-56" />
        <RecapCard showcase={content.showcase} className="landing-card xl:absolute xl:right-[4.5%] xl:bottom-[-20px] xl:w-56" />
      </div>
    </section>
  );
}

import { GENERIC_LANDING, type LandingContent } from "./content";
import { CtaSection } from "./cta-section";
import { DataProtection } from "./data-protection";
import { landingHeading } from "./fonts";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { TopBar } from "./top-bar";

/**
 * Public marketing page. Static copy only: it must not read the database or show any
 * organization data (spec: landing-page). The contact CTA links to `/daftar`, which owns the WhatsApp handoff.
 */
export function LandingPage({ content = GENERIC_LANDING }: { content?: LandingContent }) {
  return (
    <div
      className={`${landingHeading.variable} landing min-h-dvh overflow-x-clip bg-(--l-paper) text-(--l-ink)`}
    >
      {/* One narrow column for the whole page; sections are framed panels inside it, not full-bleed bands. */}
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
        <TopBar segmentLink={content.segmentLink} />
        <main>
          <Hero content={content} />
          <HowItWorks content={content} />
          <DataProtection protection={content.protection} />
          <CtaSection cta={content.cta} />
        </main>
        <Footer />
      </div>
    </div>
  );
}

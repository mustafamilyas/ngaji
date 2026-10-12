import { contactWhatsappUrl } from "@/lib/landing/contact";
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
 * organization data (spec: landing-page). The only runtime input is `DAHAN_WHATSAPP`.
 */
export function LandingPage({ content = GENERIC_LANDING }: { content?: LandingContent }) {
  const whatsappHref = contactWhatsappUrl();
  return (
    // The bare app frame pads its children; cancel that so sections can run edge to edge.
    <div
      className={`${landingHeading.variable} landing -mx-4 -my-6 min-h-dvh overflow-x-clip bg-(--l-paper) text-(--l-ink)`}
    >
      <TopBar />
      <main>
        <Hero content={content} />
        <HowItWorks steps={content.steps} />
        <DataProtection protection={content.protection} />
        {whatsappHref && <CtaSection cta={content.cta} href={whatsappHref} />}
      </main>
      <Footer />
    </div>
  );
}

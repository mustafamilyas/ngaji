import { Building2, EyeOff, History, Scale, Undo2, type LucideIcon } from "lucide-react";
import type { LandingContent } from "./content";

/** One icon per protection point, in the order of `PROTECTION_POINTS`. */
const ICONS: LucideIcon[] = [History, Undo2, EyeOff, Building2, Scale];

export function DataProtection({ protection }: { protection: LandingContent["protection"] }) {
  return (
    <section
      aria-labelledby="data-dijaga"
      id="keamanan"
      className="mt-24 scroll-mt-6 rounded-[28px] bg-(--l-ink) px-6 py-12 text-(--l-paper) sm:px-10 lg:mt-32 lg:px-14 lg:py-16"
    >
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="max-w-sm">
          <h2
            id="data-dijaga"
            className="font-(family-name:--font-landing) text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl"
          >
            {protection.title}
          </h2>
          <p className="mt-4 leading-relaxed text-(--l-paper)/70">{protection.intro}</p>
        </div>
        <ul className="flex flex-col gap-5">
          {protection.points.map((point, i) => {
            const Icon = ICONS[i] ?? History;
            return (
              <li key={point} className="flex gap-3.5 leading-relaxed">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--l-paper)/8 text-(--l-sap)">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <span className="pt-1 text-(--l-paper)/90">{point}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

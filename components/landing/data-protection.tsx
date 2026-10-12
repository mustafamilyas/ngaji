import type { LandingContent } from "./content";

export function DataProtection({ protection }: { protection: LandingContent["protection"] }) {
  return (
    <section aria-labelledby="data-dijaga" className="bg-(--l-ink) px-4 py-14 text-(--l-paper) sm:px-8 lg:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="max-w-md">
          <h2 id="data-dijaga" className="font-(family-name:--font-landing) text-3xl font-bold tracking-tight">
            {protection.title}
          </h2>
          <p className="mt-3 leading-relaxed text-(--l-paper)/75">{protection.intro}</p>
        </div>
        <ul className="flex max-w-2xl flex-col divide-y divide-(--l-paper)/15">
          {protection.points.map((point) => (
            <li key={point} className="py-3.5 leading-relaxed first:pt-0">
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

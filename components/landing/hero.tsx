import Link from "next/link";
import type { LandingContent } from "./content";
import { HierarchyDiagram } from "./hierarchy-diagram";

export function Hero({ content }: { content: LandingContent }) {
  return (
    <section className="grid items-center gap-10 px-4 pb-14 pt-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pb-20 lg:pt-12">
      <div className="flex max-w-xl flex-col gap-5">
        <h1 className="font-(family-name:--font-landing) text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">
          {content.headline}
        </h1>
        <p className="text-lg leading-relaxed text-(--l-muted)">{content.lead}</p>
        {content.segmentLink && (
          <p className="text-sm text-(--l-muted)">
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
      <div className="flex justify-center lg:justify-end">
        <HierarchyDiagram levels={content.levels} label={content.diagramLabel} />
      </div>
    </section>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SAMPLE_ATTENDEES, type LandingContent } from "./content";
import { HierarchyDiagram } from "./hierarchy-diagram";

/**
 * The four steps as an asymmetric grid: the tree tile is the anchor, the others
 * each carry a small picture of what that step looks like in the app.
 */
export function HowItWorks({ content }: { content: LandingContent }) {
  const [tree, schedule, attendance, recap] = content.steps;
  const leafLevel = content.levels[3].toLowerCase();

  return (
    <section aria-labelledby="cara-kerja-judul" id="cara-kerja" className="scroll-mt-6 pt-24 lg:pt-32">
      <h2
        id="cara-kerja-judul"
        className="max-w-xl font-(family-name:--font-landing) text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl"
      >
        Cara kerjanya
      </h2>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-(--l-muted)">
        Empat langkah, dari menyusun struktur sampai membaca rekap.
      </p>

      <ol className="mt-10 grid gap-4 lg:grid-cols-6">
        <Tile step={1} item={tree} className="bg-white lg:col-span-4">
          <div className="mt-6 flex justify-center">
            <HierarchyDiagram levels={content.levels} label={content.diagramLabel} />
          </div>
        </Tile>

        <Tile step={2} item={schedule} className="bg-(--l-mist) lg:col-span-2">
          <div aria-hidden="true" className="mt-6 flex flex-col items-center gap-3">
            <span className="rounded-full bg-(--l-sap) px-3 py-1 text-xs font-semibold text-(--l-ink)">
              {content.showcase.activity}
            </span>
            <span className="h-6 w-px bg-(--l-leaf)/40" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="size-5 rounded-full border-2 border-(--l-leaf)/50 bg-white p-[3px]">
                  <span className="block size-full rounded-full bg-(--l-sap)" />
                </span>
              ))}
            </div>
            <span className="text-xs text-(--l-muted)">
              {content.showcase.leafCount} {leafLevel} ikut terjadwal
            </span>
          </div>
        </Tile>

        <Tile step={3} item={attendance} className="bg-(--l-leaf) text-white lg:col-span-2" tone="dark">
          <div aria-hidden="true" className="mx-auto mt-6 w-full max-w-[220px] rounded-[26px] border-4 border-(--l-ink)/40 bg-white p-3 text-(--l-ink)">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-(--l-ink)/15" />
            <ul className="flex flex-col gap-2 text-xs">
              {SAMPLE_ATTENDEES.map((person) => (
                <li key={person.name} className="flex items-center justify-between gap-2 rounded-lg bg-(--l-paper) px-2.5 py-2">
                  <span className="truncate">{person.name}</span>
                  <span
                    className={cn(
                      "size-4 shrink-0 rounded-full",
                      person.status === "Hadir" ? "bg-(--l-leaf)" : "border-2 border-(--l-sap)",
                    )}
                  />
                </li>
              ))}
            </ul>
          </div>
        </Tile>

        <Tile step={4} item={recap} className="bg-white lg:col-span-4">
          <div aria-hidden="true" className="mt-6 grid grid-cols-3 items-end gap-3 sm:gap-5">
            {content.showcase.recap.map((row) => (
              <div key={row.name} className="flex flex-col gap-2">
                <div className="flex h-24 items-end rounded-xl bg-(--l-mist)/70 p-1.5">
                  <div className="w-full rounded-lg bg-(--l-leaf)" style={{ height: `${row.percent}%` }} />
                </div>
                <span className="truncate text-xs text-(--l-muted)">{row.name}</span>
                <span className="font-(family-name:--font-landing) text-xl font-bold tabular-nums">{row.percent}%</span>
              </div>
            ))}
          </div>
        </Tile>
      </ol>
    </section>
  );
}

function Tile({
  step,
  item,
  className,
  tone = "light",
  children,
}: {
  step: number;
  item: LandingContent["steps"][number];
  className?: string;
  tone?: "light" | "dark";
  children: ReactNode;
}) {
  return (
    <li className={cn("flex flex-col rounded-3xl border border-(--l-ink)/8 p-6 sm:p-8", className)}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            tone === "dark" ? "bg-white text-(--l-leaf)" : "bg-(--l-ink) text-(--l-paper)",
          )}
        >
          {step}
        </span>
        <div>
          <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
          <p className={cn("mt-1 leading-relaxed", tone === "dark" ? "text-white/80" : "text-(--l-muted)")}>{item.body}</p>
        </div>
      </div>
      <div className="mt-auto">{children}</div>
    </li>
  );
}

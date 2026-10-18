import { CalendarPlus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_ATTENDEES, type LandingContent } from "./content";

/**
 * Small, static renderings of real Dahan screens for the hero. Illustrative only:
 * fictional sample data from `content.ts`, hidden from assistive tech by the caller.
 */

const CARD = "rounded-2xl border border-(--l-ink)/10 bg-white p-4 text-left shadow-[0_1px_0_rgb(22_36_29/0.04),0_12px_32px_-12px_rgb(22_36_29/0.22)]";

type Showcase = LandingContent["showcase"];

export function ActivityCard({ showcase, leafLevel, className }: { showcase: Showcase; leafLevel: string; className?: string }) {
  return (
    <div className={cn(CARD, "w-60", className)}>
      <div className="flex items-center gap-2 text-xs text-(--l-muted)">
        <span className="flex size-6 items-center justify-center rounded-full bg-(--l-sap)/20 text-(--l-ink)">
          <CalendarPlus className="size-3.5" />
        </span>
        Kegiatan baru di {showcase.groups[0]}
      </div>
      <p className="mt-3 font-semibold leading-snug">{showcase.activity}</p>
      <p className="mt-0.5 text-sm text-(--l-muted)">{showcase.schedule}</p>
      <p className="mt-3 rounded-lg bg-(--l-sap)/15 px-2.5 py-1.5 text-xs font-medium text-(--l-ink)">
        Berlaku untuk {showcase.leafCount} {leafLevel.toLowerCase()}
      </p>
    </div>
  );
}

export function TreeCard({ showcase, className }: { showcase: Showcase; className?: string }) {
  return (
    <div className={cn(CARD, "w-60", className)}>
      <p className="text-xs text-(--l-muted)">Pohon grup</p>
      <ul className="mt-2.5 flex flex-col gap-1.5 text-sm">
        {showcase.groups.map((group, depth) => (
          <li key={group} className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 0.85}rem` }}>
            {depth > 0 && <ChevronRight className="size-3.5 shrink-0 text-(--l-leaf)/60" />}
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                depth === showcase.groups.length - 1 ? "bg-(--l-sap)" : "bg-(--l-leaf)",
              )}
            />
            <span className={cn("truncate", depth === showcase.groups.length - 1 && "font-semibold")}>{group}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AttendanceCard({ showcase, className }: { showcase: Showcase; className?: string }) {
  return (
    <div className={cn(CARD, "w-64", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold">{showcase.groups[3]}</p>
        <p className="shrink-0 text-xs text-(--l-muted)">Hari ini</p>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {SAMPLE_ATTENDEES.map((person) => (
          <li key={person.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{person.name}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                person.status === "Hadir" ? "bg-(--l-leaf)/12 text-(--l-leaf)" : "bg-(--l-sap)/20 text-(--l-ink)",
              )}
            >
              {person.status}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-(--l-ink)/10 pt-2.5 text-xs text-(--l-muted)">18 dari 22 anggota hadir</p>
    </div>
  );
}

export function RecapCard({ showcase, className }: { showcase: Showcase; className?: string }) {
  return (
    <div className={cn(CARD, "w-64", className)}>
      <p className="text-xs text-(--l-muted)">Kehadiran 30 hari terakhir</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {showcase.recap.map((row) => (
          <li key={row.name} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="truncate">{row.name}</span>
              <span className="font-semibold tabular-nums">{row.percent}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-(--l-mist)">
              <div className="h-full rounded-full bg-(--l-leaf)" style={{ width: `${row.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDown, TagIcon, X } from "lucide-react";
import { TagChip } from "@/components/tags/tag-chip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterTriggerClass } from "@/components/filters/filter-bar";
import { SUMMARY_MAX_BARS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TagBreakdown } from "@/lib/stats";
import { selectedChoice, type TagChoiceGroup } from "@/lib/tag/choices";
import { SummaryChart } from "../tampilan/summary-chart";

function formatPercent(percent: number): string {
  return `${percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

/** Matches the typed text against the key, not against the id cmdk uses as the item's unique value. */
function filterChoices(_value: string, search: string, keywords?: string[]): number {
  return (keywords ?? []).join(" ").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0;
}

/**
 * Statistik → Anggota "Per tag": the viewer picks one visible simple tag or tag key (`?tag=`), and the card
 * lists AKTIF members per value plus "Tanpa nilai". The picker navigates with the other query params kept, so the
 * server stays the only place that decides what counts. The chart draws the first `SUMMARY_MAX_BARS` buckets; the
 * table beneath lists all of them, so the numbers are always available as text.
 */
export function TagBreakdownCard({
  choices,
  breakdown,
  total,
  basePath,
  query,
}: {
  choices: TagChoiceGroup[];
  breakdown: TagBreakdown | null;
  total: number;
  basePath: string;
  /** Current query params without `tag`. */
  query: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selected = selectedChoice(choices, breakdown?.tagId);
  const hasChoices = choices.some((g) => g.choices.length > 0);

  function go(tagId?: number) {
    const next = new URLSearchParams(query);
    if (tagId !== undefined) next.set("tag", String(tagId));
    setOpen(false);
    router.push(`${basePath}?${next.toString()}`, { scroll: false });
  }

  const rows = (breakdown?.buckets ?? []).map((bucket) => ({
    ...bucket,
    percent: total === 0 ? 0 : (bucket.count / total) * 100,
  }));

  return (
    <section aria-labelledby="per-tag" className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="per-tag" className="text-sm font-medium">Per tag</h3>
        {hasChoices && (
          <div className="flex min-w-0 max-w-full items-center gap-1">
            <Popover open={open} onOpenChange={setOpen}>
              {/* min-w-0 lets a long key shrink (ellipsis) so the clear button never leaves the card on a phone. */}
              <PopoverTrigger className={cn(filterTriggerClass(Boolean(selected)), "min-w-0")} aria-label={selected ? `Tag: ${selected.label}` : "Pilih tag"}>
                <TagIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 max-w-56 truncate">{selected ? selected.label : "Pilih tag"}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </PopoverTrigger>
              <PopoverContent
                className="flex w-[min(22rem,calc(100vw-24px))] flex-col"
                // Don't pop the on-screen keyboard on phones; desktop users can type to search right away.
                initialFocus={(openType) => openType !== "touch"}
              >
                <Command filter={filterChoices} className="max-h-[min(24rem,70dvh)]">
                  <CommandInput placeholder="Cari tag" aria-label="Cari tag" />
                  <CommandList>
                    <CommandEmpty>Tag tidak ditemukan.</CommandEmpty>
                    {choices
                      .filter((g) => g.choices.length > 0)
                      .map(({ group, choices: groupChoices }) => (
                        <CommandGroup key={group.id} heading={group.isOwn ? "Grup sendiri" : group.name}>
                          {groupChoices.map((choice) => (
                            <CommandItem key={choice.id} value={String(choice.id)} keywords={[choice.label]} onSelect={() => go(choice.id)}>
                              <CheckIcon className={selected?.id === choice.id ? "size-4 shrink-0" : "size-4 shrink-0 opacity-0"} aria-hidden />
                              <TagChip tag={{ key: choice.label, value: null, color: choice.color }} wrap />
                              {choice.kind === "tagKey" && <span className="text-xs text-muted-foreground">{choice.tagIds.length} nilai</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selected && (
              <button
                type="button"
                aria-label="Hapus pilihan tag"
                onClick={() => go()}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground xl:size-9"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>

      {!hasChoices ? (
        <p className="text-sm text-muted-foreground">Belum ada tag.</p>
      ) : !breakdown ? (
        <p className="text-sm text-muted-foreground">Pilih tag untuk melihat rinciannya.</p>
      ) : (
        <>
          <SummaryChart buckets={rows.slice(0, SUMMARY_MAX_BARS)} />
          <div className="overflow-x-auto">
            <table className="w-full text-base xl:text-sm">
              <caption className="sr-only">Jumlah anggota per {breakdown.label}</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Kategori</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Jumlah</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">Persen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <th scope="row" className="min-w-32 py-2 pr-3 text-left font-normal break-words">{row.label}</th>
                    <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                    <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">{formatPercent(row.percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

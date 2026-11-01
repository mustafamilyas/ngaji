"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDown, ListFilter, X } from "lucide-react";
import { TagChip } from "@/components/tags/tag-chip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterTriggerClass } from "@/components/filters/filter-bar";
import type { TagChoiceGroup } from "@/lib/tag/choices";
import { cn } from "@/lib/utils";
import { FIXED_BREAKDOWN_OPTIONS } from "./options";

/** Matches the typed text against the label only, not the value cmdk uses as the item's unique key. */
function filterOptions(_value: string, search: string, keywords?: string[]): number {
  return (keywords ?? []).join(" ").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0;
}

/**
 * "Rincian menurut": a searchable popover that picks one member dimension or one visible tag (`?rincian=`).
 * It navigates with the other query params kept, and drops the breakdown table's page so a new choice starts on
 * page 1. The server stays the only place that decides what the choice means.
 */
export function BreakdownPicker({
  choices,
  selected,
  selectedLabel,
  basePath,
  query,
}: {
  choices: TagChoiceGroup[];
  /** The `?rincian=` value in effect (already validated by the server), if any. */
  selected: string | undefined;
  selectedLabel: string | undefined;
  basePath: string;
  /** Current query params without `rincian` and its page. */
  query: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function go(value?: string) {
    const next = new URLSearchParams(query);
    if (value !== undefined) next.set("rincian", value);
    setOpen(false);
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  const tagGroups = choices.filter((g) => g.choices.length > 0);

  return (
    <div className="flex min-w-0 max-w-full items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(filterTriggerClass(Boolean(selected)), "min-w-0")}
          aria-label={selectedLabel ? `Rincian menurut: ${selectedLabel}` : "Rincian menurut"}
        >
          <ListFilter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 max-w-56 truncate">{selectedLabel ?? "Rincian menurut"}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </PopoverTrigger>
        <PopoverContent
          className="flex w-[min(22rem,calc(100vw-24px))] flex-col"
          // Don't pop the on-screen keyboard on phones; desktop users can type to search right away.
          initialFocus={(openType) => openType !== "touch"}
        >
          <Command filter={filterOptions} className="max-h-[min(24rem,70dvh)]">
            <CommandInput placeholder="Cari rincian" aria-label="Cari rincian" />
            <CommandList>
              <CommandEmpty>Rincian tidak ditemukan.</CommandEmpty>
              <CommandGroup heading="Data anggota">
                {FIXED_BREAKDOWN_OPTIONS.map((option) => (
                  <CommandItem key={option.value} value={option.value} keywords={[option.label]} onSelect={() => go(option.value)}>
                    <CheckIcon className={selected === option.value ? "size-4 shrink-0" : "size-4 shrink-0 opacity-0"} aria-hidden />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {tagGroups.map(({ group, choices: groupChoices }) => (
                <CommandGroup key={group.id} heading={group.isOwn ? "Tag grup sendiri" : `Tag ${group.name}`}>
                  {groupChoices.map((choice) => {
                    const value = `tag:${choice.id}`;
                    const isSelected = choice.tagIds.some((id) => `tag:${id}` === selected);
                    return (
                      <CommandItem key={choice.id} value={value} keywords={[choice.label]} onSelect={() => go(value)}>
                        <CheckIcon className={isSelected ? "size-4 shrink-0" : "size-4 shrink-0 opacity-0"} aria-hidden />
                        <TagChip tag={{ key: choice.label, value: null, color: choice.color }} wrap />
                        {choice.kind === "tagKey" && <span className="text-xs text-muted-foreground">{choice.tagIds.length} nilai</span>}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <button
          type="button"
          aria-label="Hapus rincian"
          onClick={() => go()}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground xl:size-9"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

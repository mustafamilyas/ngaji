"use client";

import { useRef, useState } from "react";
import { CheckIcon, ChevronDown, TagIcon } from "lucide-react";
import { TagChip } from "@/components/tags/tag-chip";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MAX_TAG_FILTER_IDS } from "@/lib/constants";
import type { TagSummary } from "@/lib/tag/include";
import type { TagOwnerGroup } from "@/lib/tag/list";
import { filterTriggerClass, submitFilterForm } from "./filter-bar";

const labelOf = (tag: Pick<TagSummary, "key" | "value">) => (tag.value === null ? tag.key : `${tag.key}:${tag.value}`);

/** Matches the typed text against `key:value`, not against the id cmdk uses as the item's unique value. */
function filterTags(_value: string, search: string, keywords?: string[]): number {
  return (keywords ?? []).join(" ").includes(search.trim().toLowerCase()) ? 1 : 0;
}

/**
 * Tag filter (`tag`): a popover to choose any number of the tags the user can see, grouped by owner, applied
 * with "Terapkan" like the group filter. A page matches entities that have ANY chosen tag. The chosen ids live
 * in one hidden input inside the surrounding `FilterBar` form (the popup is portaled out of it), so the other
 * filters keep the selection when they submit. `selected` holds only ids the server resolved as visible.
 */
export function TagFilter({ tags, selected: selectedProp, name = "tag" }: { tags: TagOwnerGroup[]; selected: number[]; name?: string }) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>(selectedProp);

  // Re-sync when the URL (and thus `selected`) changes under us.
  const selectedKey = selectedProp.join(",");
  const [prevKey, setPrevKey] = useState(selectedKey);
  if (selectedKey !== prevKey) {
    setPrevKey(selectedKey);
    setDraft(selectedProp);
  }

  const byId = new Map(tags.flatMap((group) => group.tags).map((tag) => [tag.id, tag]));
  const chosen = selectedProp.map((id) => byId.get(id)).filter((tag): tag is TagSummary => Boolean(tag));
  const triggerLabel = chosen.length === 0 ? "Tag" : chosen.length === 1 ? labelOf(chosen[0]) : `${labelOf(chosen[0])} +${chosen.length - 1}`;
  const draftSet = new Set(draft);

  function toggle(id: number) {
    setDraft((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function apply(ids: number[]) {
    if (hiddenRef.current) hiddenRef.current.value = ids.join(",");
    setOpen(false);
    submitFilterForm(hiddenRef.current);
  }

  return (
    <>
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={selectedKey} key={selectedKey} />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft(selectedProp);
        }}
      >
        <PopoverTrigger data-slot="tag-filter" className={filterTriggerClass(selectedProp.length > 0)}>
          <TagIcon className="size-4 text-muted-foreground" aria-hidden />
          <span className="max-w-56 truncate">{triggerLabel}</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </PopoverTrigger>
        <PopoverContent
          className="flex w-[min(22rem,calc(100vw-24px))] flex-col"
          // Don't pop the on-screen keyboard on phones; desktop users can type to search right away.
          initialFocus={(openType) => openType !== "touch"}
        >
          <Command filter={filterTags} className="max-h-[min(24rem,70dvh)]">
            <CommandInput placeholder="Cari tag" aria-label="Cari tag" />
            <CommandList>
              <CommandEmpty>Tag tidak ditemukan.</CommandEmpty>
              {tags.map(({ group, tags: groupTags }) => (
                <CommandGroup key={group.id} heading={group.isOwn ? "Grup sendiri" : group.name}>
                  {groupTags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={String(tag.id)}
                      keywords={[labelOf(tag)]}
                      disabled={!draftSet.has(tag.id) && draft.length >= MAX_TAG_FILTER_IDS}
                      onSelect={() => toggle(tag.id)}
                    >
                      <CheckIcon className={draftSet.has(tag.id) ? "size-4 shrink-0" : "size-4 shrink-0 opacity-0"} aria-hidden />
                      <TagChip tag={tag} wrap />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <Button type="button" variant="ghost" disabled={draft.length === 0} onClick={() => setDraft([])}>
              Kosongkan
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{draft.length} dipilih</span>
              <Button type="button" onClick={() => apply(draft)}>
                Terapkan
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

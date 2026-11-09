"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Filter, Plus, X } from "lucide-react";
import { filterTriggerClass } from "@/components/filters/filter-bar";
import { Button } from "@/components/ui/button";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VIEW_MAX_RULE_GROUPS } from "@/lib/constants";
import { encodeDraft } from "@/lib/member-view/draft";
import { addRuleGroup, describeRule, removeRuleGroup, replaceRuleGroup, setFilterOp } from "@/lib/member-view/edit";
import type { EditorOptions } from "@/lib/member-view/editor-options";
import type { Definition, RuleGroup } from "@/lib/validation/member-view";
import { ApplyFooter, RuleGroupEditor, nativeSelectClass } from "./rule-editor";
import { useDraft } from "./use-draft";
import { ViewMenu } from "./view-menu";

const NEW_RULE = { field: "status", operator: "isAnyOf", value: ["AKTIF"] } as const;

function summarize(group: RuleGroup, groupLabels: ReadonlyMap<number, string>, tagLabels: ReadonlyMap<number, string>): string {
  const joiner = group.op === "AND" ? " dan " : " atau ";
  return group.rules.map((rule) => describeRule(rule, groupLabels, tagLabels)).join(joiner);
}

/**
 * Filter bar and "Tampilan" menu. Edits never touch the database: an applied
 * change re-encodes the whole definition into `?d=` and navigates, so the
 * server re-validates and re-renders (design §6). Edits inside a panel (chip
 * popover, phone sheet, Tampilan menu) stay in a local draft and apply once,
 * on "Terapkan" or when the panel closes; single clicks on the chip row apply
 * at once. Desktop shows rule groups as chips with a popover editor; phones
 * get one "Filter" button that opens a bottom sheet with every group.
 */
export function ViewToolbar({
  definition,
  options,
  basePath,
}: {
  definition: Definition;
  options: EditorOptions;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The last applied definition, ahead of the server's re-render, so a click right after a panel closes builds on it.
  const [applied, setApplied] = useOptimistic(definition);
  const [error, setError] = useState<string | null>(null);
  const [openChip, setOpenChip] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const groupLabels = new Map(options.groups.map((g) => [g.id, g.label]));
  const tagLabels = new Map(options.tags.map((t) => [t.id, t.label]));

  function apply(next: Definition) {
    const encoded = encodeDraft(next);
    if (encoded === null) {
      setError("Perubahan terlalu panjang untuk disimpan di tautan. Kurangi aturan atau pilihan.");
      return;
    }
    setError(null);
    startTransition(() => {
      setApplied(next);
      router.replace(`${basePath}?d=${encoded}`, { scroll: false });
    });
  }

  const draft = useDraft(applied, apply);
  const shown = draft.value;
  const { groups, op } = shown.filter;
  const newGroup = () => addRuleGroup(shown, { ...NEW_RULE, value: [...NEW_RULE.value] });

  const openChipAt = (index: number | null, start?: Definition) => {
    if (index === null) draft.commit();
    else draft.begin(start);
    setOpenChip(index);
  };
  const openSheet = (open: boolean) => {
    if (open) draft.begin();
    else draft.commit();
    setSheetOpen(open);
  };

  const editor = (group: RuleGroup, index: number, onDone?: () => void) => (
    <RuleGroupEditor
      key={`${groups.length}-${index}`}
      group={group}
      groups={options.groups}
      tags={options.tags}
      onChange={(next) => draft.edit(replaceRuleGroup(shown, index, next))}
      onRemove={() => (onDone ? onDone() : draft.edit(removeRuleGroup(shown, index)))}
    />
  );

  const topOpSelect = (
    <select
      aria-label="Gabungkan filter"
      className={nativeSelectClass}
      value={op}
      onChange={(e) => draft.edit(setFilterOp(shown, e.target.value as "AND" | "OR"))}
    >
      <option value="AND">Semua filter berlaku (DAN)</option>
      <option value="OR">Salah satu filter berlaku (ATAU)</option>
    </select>
  );

  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Desktop: chips */}
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          {groups.map((group, index) => (
            <span key={`${groups.length}-${index}`} className="inline-flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  className="min-h-11 min-w-11 rounded-md px-1.5 py-0.5 text-sm font-medium text-muted-foreground hover:bg-muted xl:min-h-0 xl:min-w-0 xl:text-xs"
                  onClick={() => apply(setFilterOp(applied, op === "AND" ? "OR" : "AND"))}
                  aria-label={`Gabungan filter: ${op === "AND" ? "DAN" : "ATAU"}. Klik untuk mengganti`}
                >
                  {op === "AND" ? "DAN" : "ATAU"}
                </button>
              )}
              <Popover open={openChip === index} onOpenChange={(open) => openChipAt(open ? index : null)}>
                <PopoverTrigger className={`${filterTriggerClass(true)} max-w-xs`}>
                  <span className="truncate">{summarize(group, groupLabels, tagLabels)}</span>
                </PopoverTrigger>
                <PopoverContent className="flex max-h-[min(30rem,var(--available-height))] w-[min(26rem,calc(100vw-24px))] flex-col">
                  <div className="min-h-0 overflow-y-auto p-3">
                    {editor(group, index, () => {
                      // "Hapus filter": drop the draft and remove this filter from what is applied (if it was applied yet).
                      draft.cancel();
                      setOpenChip(null);
                      if (index < applied.filter.groups.length) apply(removeRuleGroup(applied, index));
                    })}
                  </div>
                  <ApplyFooter onApply={() => openChipAt(null)} />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Hapus filter"
                onClick={() => apply(removeRuleGroup(applied, index))}
              >
                <X />
              </Button>
            </span>
          ))}
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={groups.length >= VIEW_MAX_RULE_GROUPS}
            onClick={() => openChipAt(groups.length, newGroup())}
          >
            <Plus />
            Tambah filter
          </Button>
        </div>

        {/* Mobile: one button, bottom sheet */}
        <Button type="button" variant="outline" size="lg" className="sm:hidden" onClick={() => openSheet(true)}>
          <Filter />
          Filter{groups.length > 0 ? ` (${groups.length})` : ""}
        </Button>

        <div className="ml-auto">
          <ViewMenu definition={applied} levels={options.levels} tags={options.tags} onChange={apply} />
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={openSheet}>
        <SheetContent side="bottom" className="max-h-[85dvh]">
          <SheetHeader>
            <SheetTitle>Filter</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4">
            {groups.length > 1 && topOpSelect}
            {groups.map((group, index) => (
              <div key={`${groups.length}-${index}`} className="rounded-lg border p-2.5">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Filter {index + 1}</p>
                {editor(group, index)}
              </div>
            ))}
            <Button type="button" variant="outline" disabled={groups.length >= VIEW_MAX_RULE_GROUPS} onClick={() => draft.edit(newGroup())}>
              <Plus />
              Tambah filter
            </Button>
          </div>
          <ApplyFooter onApply={() => openSheet(false)} />
        </SheetContent>
      </Sheet>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

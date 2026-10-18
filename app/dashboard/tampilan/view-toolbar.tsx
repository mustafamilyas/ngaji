"use client";

import { useState, useTransition } from "react";
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
import { RuleGroupEditor, nativeSelectClass } from "./rule-editor";
import { ViewMenu } from "./view-menu";

const NEW_RULE = { field: "status", operator: "isAnyOf", value: ["AKTIF"] } as const;

function summarize(group: RuleGroup, groupLabels: ReadonlyMap<number, string>): string {
  const joiner = group.op === "AND" ? " dan " : " atau ";
  return group.rules.map((rule) => describeRule(rule, groupLabels)).join(joiner);
}

/**
 * Filter bar and "Tampilan" menu. Edits never touch the database: each
 * confirmed change re-encodes the whole definition into `?d=` and navigates,
 * so the server re-validates and re-renders (design §6). Desktop shows rule
 * groups as chips with a popover editor; phones get one "Filter" button that
 * opens a bottom sheet with every group.
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
  const [error, setError] = useState<string | null>(null);
  const [openChip, setOpenChip] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const groupLabels = new Map(options.groups.map((g) => [g.id, g.label]));
  const { groups, op } = definition.filter;

  function apply(next: Definition) {
    const encoded = encodeDraft(next);
    if (encoded === null) {
      setError("Perubahan terlalu panjang untuk disimpan di tautan. Kurangi aturan atau pilihan.");
      return;
    }
    setError(null);
    startTransition(() => router.replace(`${basePath}?d=${encoded}`, { scroll: false }));
  }

  const addGroup = () => {
    apply(addRuleGroup(definition, { ...NEW_RULE, value: [...NEW_RULE.value] }));
    setOpenChip(groups.length);
  };

  const editor = (group: RuleGroup, index: number, onDone?: () => void) => (
    <RuleGroupEditor
      key={`${groups.length}-${index}`}
      group={group}
      groups={options.groups}
      onChange={(next) => apply(replaceRuleGroup(definition, index, next))}
      onRemove={() => {
        apply(removeRuleGroup(definition, index));
        onDone?.();
      }}
    />
  );

  const topOpSelect = (
    <select
      aria-label="Gabungkan filter"
      className={nativeSelectClass}
      value={op}
      onChange={(e) => apply(setFilterOp(definition, e.target.value as "AND" | "OR"))}
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
                  className="rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  onClick={() => apply(setFilterOp(definition, op === "AND" ? "OR" : "AND"))}
                  aria-label={`Gabungan filter: ${op === "AND" ? "DAN" : "ATAU"}. Klik untuk mengganti`}
                >
                  {op === "AND" ? "DAN" : "ATAU"}
                </button>
              )}
              <Popover open={openChip === index} onOpenChange={(open) => setOpenChip(open ? index : null)}>
                <PopoverTrigger className={`${filterTriggerClass(true)} max-w-xs`}>
                  <span className="truncate">{summarize(group, groupLabels)}</span>
                </PopoverTrigger>
                <PopoverContent className="w-[min(26rem,calc(100vw-24px))]">
                  <div className="max-h-[min(30rem,var(--available-height))] overflow-y-auto p-3">
                    {editor(group, index, () => setOpenChip(null))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Hapus filter"
                onClick={() => apply(removeRuleGroup(definition, index))}
              >
                <X />
              </Button>
            </span>
          ))}
          <Button type="button" variant="outline" size="lg" disabled={groups.length >= VIEW_MAX_RULE_GROUPS} onClick={addGroup}>
            <Plus />
            Tambah filter
          </Button>
        </div>

        {/* Mobile: one button, bottom sheet */}
        <Button type="button" variant="outline" size="lg" className="sm:hidden" onClick={() => setSheetOpen(true)}>
          <Filter />
          Filter{groups.length > 0 ? ` (${groups.length})` : ""}
        </Button>

        <div className="ml-auto">
          <ViewMenu definition={definition} levels={options.levels} onChange={apply} />
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filter</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            {groups.length > 1 && topOpSelect}
            {groups.map((group, index) => (
              <div key={`${groups.length}-${index}`} className="rounded-lg border p-2.5">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Filter {index + 1}</p>
                {editor(group, index)}
              </div>
            ))}
            <Button type="button" variant="outline" disabled={groups.length >= VIEW_MAX_RULE_GROUPS} onClick={() => apply(addRuleGroup(definition, { ...NEW_RULE, value: [...NEW_RULE.value] }))}>
              <Plus />
              Tambah filter
            </Button>
          </div>
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

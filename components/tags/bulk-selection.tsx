"use client";

import { createContext, useContext, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { TagSummary } from "@/lib/tag/include";

type BulkSelection = {
  /** Selected member ids, in the page's order. */
  selectedIds: number[];
  memberIds: number[];
  /** Visible tags of each member on the page, to offer only removable tags. */
  memberTags: Record<number, TagSummary[]>;
  isSelected: (id: number) => boolean;
  toggle: (id: number, checked: boolean) => void;
  selectAll: (checked: boolean) => void;
  clear: () => void;
  /** Result of the last bulk action, shown by the bar once the selection is cleared. */
  message: string | null;
  setMessage: (message: string | null) => void;
};

const BulkSelectionContext = createContext<BulkSelection | null>(null);

export function useBulkSelection(): BulkSelection | null {
  return useContext(BulkSelectionContext);
}

/**
 * Which rows of the current page are selected. The page gives it a `key` made of the page's member ids, so
 * changing page, filter or sort starts from an empty selection (a selection never spans pages).
 */
export function BulkSelectionProvider({
  memberIds,
  memberTags,
  children,
}: {
  memberIds: number[];
  memberTags: Record<number, TagSummary[]>;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const value: BulkSelection = {
    selectedIds: memberIds.filter((id) => selected.has(id)),
    memberIds,
    memberTags,
    isSelected: (id) => selected.has(id),
    toggle: (id, checked) =>
      setSelected((current) => {
        const next = new Set(current);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      }),
    selectAll: (checked) => setSelected(checked ? new Set(memberIds) : new Set()),
    clear: () => setSelected(new Set()),
    message,
    setMessage,
  };
  return <BulkSelectionContext.Provider value={value}>{children}</BulkSelectionContext.Provider>;
}

/** Row checkbox; the label gives it a 44px hit area below `xl`. */
export function RowCheckbox({ memberId, name }: { memberId: number; name: string }) {
  const selection = useBulkSelection();
  if (!selection) return null;
  return (
    <label className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center xl:size-6">
      <Checkbox
        aria-label={`Pilih ${name}`}
        checked={selection.isSelected(memberId)}
        onCheckedChange={(checked) => selection.toggle(memberId, checked)}
      />
    </label>
  );
}

/** "Pilih semua" for the current page; indeterminate while only some rows are selected. */
export function SelectAllRow() {
  const selection = useBulkSelection();
  if (!selection) return null;
  const count = selection.selectedIds.length;
  const total = selection.memberIds.length;
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 border-b px-4 text-base xl:min-h-9 xl:text-sm">
      <span className="inline-flex size-11 items-center justify-center xl:size-6">
        <Checkbox
          aria-label={`Pilih semua di halaman ini (${total})`}
          checked={count === total && total > 0}
          indeterminate={count > 0 && count < total}
          onCheckedChange={(checked) => selection.selectAll(checked)}
        />
      </span>
      <span className="text-muted-foreground">Pilih semua di halaman ini</span>
    </label>
  );
}

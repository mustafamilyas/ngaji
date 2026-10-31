"use client";

import { useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { bulkTagMembersAction } from "@/app/dashboard/tag/actions";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { TagSummary } from "@/lib/tag/include";
import type { BULK_TAG_OPS } from "@/lib/validation/tag";
import { useBulkSelection } from "./bulk-selection";
import { TagChip } from "./tag-chip";
import { useTagOptions } from "./tag-options-context";
import { TagOverlay } from "./tag-overlay";

type Op = (typeof BULK_TAG_OPS)[number];

const labelOf = (tag: Pick<TagSummary, "key" | "value">) => (tag.value === null ? tag.key : `${tag.key}:${tag.value}`);

function filterTags(_value: string, search: string, keywords?: string[]): number {
  return (keywords ?? []).join(" ").includes(search.trim().toLowerCase()) ? 1 : 0;
}

/** One action of the bar: choose a tag, then confirm what will happen to how many members, then apply. */
function BulkChooser({ op, label, shortLabel }: { op: Op; label: string; shortLabel: string }) {
  const selection = useBulkSelection();
  const tagOptions = useTagOptions();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<TagSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!selection || !tagOptions) return null;

  const bulk = selection;
  const { selectedIds, memberTags } = bulk;
  // Removing only makes sense for tags a selected member has.
  const present = new Set(selectedIds.flatMap((id) => (memberTags[id] ?? []).map((tag) => tag.id)));
  const groups = tagOptions.options
    .map((group) => ({ ...group, tags: op === "add" ? group.tags : group.tags.filter((tag) => present.has(tag.id)) }))
    .filter((group) => group.tags.length > 0);
  const holders = chosen ? selectedIds.filter((id) => (memberTags[id] ?? []).some((tag) => tag.id === chosen.id)).length : 0;

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setChosen(null);
      setError(null);
    }
  }

  function apply() {
    if (!chosen) return;
    setError(null);
    startTransition(async () => {
      const result = await bulkTagMembersAction({ memberIds: selectedIds, tagId: chosen.id, op });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      bulk.setMessage(result.data.changed > 0 ? `${result.data.changed} anggota diubah.` : "Tidak ada anggota yang berubah.");
      bulk.clear();
      reset(false);
    });
  }

  return (
    <TagOverlay
      open={open}
      onOpenChange={reset}
      trigger={
        // Below `sm` the short word keeps the bar on one row; the full name stays the accessible name.
        <Button type="button" variant="outline" aria-label={label} aria-haspopup="dialog" aria-expanded={open} className="px-3 sm:px-4">
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </Button>
      }
      title={label}
      description="Pilih tag, lalu konfirmasi."
    >
      {chosen ? (
        <div className="flex flex-col gap-3 p-4">
          <TagChip tag={chosen} wrap className="self-start" />
          <p className="text-base xl:text-sm">
            {op === "add"
              ? `Tambah "${labelOf(chosen)}" ke ${selectedIds.length} anggota?`
              : `Hapus "${labelOf(chosen)}" dari anggota terpilih? ${holders} dari ${selectedIds.length} anggota memilikinya.`}
          </p>
          {op === "add" && chosen.value !== null && (
            <p className="text-sm text-muted-foreground">Nilai lain dari kunci ini akan diganti.</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setChosen(null)}>
              Kembali
            </Button>
            <Button type="button" disabled={pending} onClick={apply}>
              {pending ? "Menerapkan…" : "Terapkan"}
            </Button>
          </div>
        </div>
      ) : (
        <Command filter={filterTags} className="max-h-[70dvh] xl:max-h-80">
          <CommandInput placeholder="Cari tag" aria-label="Cari tag" />
          <CommandList className="pb-[env(safe-area-inset-bottom)]">
            <CommandEmpty>{op === "remove" ? "Tidak ada tag untuk dihapus dari anggota terpilih." : "Tidak ditemukan."}</CommandEmpty>
            {groups.map(({ group, tags }) => (
              <CommandGroup key={group.id} heading={group.isOwn ? "Grup sendiri" : group.name}>
                {tags.map((tag) => (
                  <CommandItem key={tag.id} value={String(tag.id)} keywords={[labelOf(tag)]} onSelect={() => setChosen(tag)}>
                    <TagChip tag={tag} wrap />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      )}
    </TagOverlay>
  );
}

/**
 * Sticky action bar of the member table: how many rows are selected, "Tambah tag", "Hapus tag" and "Batal";
 * after an action it shows the result until the next selection. It sits after the table card (not inside, which
 * clips) so it rests above the pager at the end of the page instead of covering it.
 */
export function BulkTagBar() {
  const selection = useBulkSelection();
  if (!selection) return null;
  const count = selection.selectedIds.length;
  // One live region that is mounted from the first render: screen readers often skip a region that appears
  // already filled, so the visible bar below carries no role of its own.
  const announcement = count > 0 ? `${count} anggota dipilih` : (selection.message ?? "");
  const liveRegion = (
    <div role="status" className="sr-only">
      {announcement}
    </div>
  );

  if (count === 0) {
    if (!selection.message) return liveRegion;
    return (
      <>
        {liveRegion}
        <div data-slot="bulk-tag-bar" className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <p className="text-base xl:text-sm" aria-hidden>
            {selection.message}
          </p>
          <Button type="button" variant="ghost" onClick={() => selection.setMessage(null)}>
            Tutup
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {liveRegion}
      <div data-slot="bulk-tag-bar" className="sticky bottom-0 z-30 flex flex-wrap items-center gap-1.5 border-t bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur -mx-4 sm:mx-0 sm:gap-2 sm:px-4">
        <p className="mr-auto text-base font-medium xl:text-sm" aria-hidden>
          {count} anggota dipilih
        </p>
        <BulkChooser op="add" label="Tambah tag" shortLabel="Tambah" />
        <BulkChooser op="remove" label="Hapus tag" shortLabel="Hapus" />
        <Button type="button" variant="ghost" aria-label="Batal" className="w-11 px-0 sm:w-auto sm:px-4" onClick={selection.clear}>
          <XIcon className="sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Batal</span>
        </Button>
      </div>
    </>
  );
}

"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import {
  attachTagAction,
  createAndAttachTagAction,
  detachTagAction,
} from "@/app/dashboard/tag/actions";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { TAG_DEFAULT_COLOR } from "@/lib/constants";
import { tagIdsReplacedBy } from "@/lib/tag/exclusive";
import type { TagSummary } from "@/lib/tag/include";
import type { TagOwnerGroup } from "@/lib/tag/list";
import { parseTagInput } from "@/lib/validation/tag";
import type { TagTarget } from "@/lib/validation/tag";
import { TagChip } from "./tag-chip";
import { useTagOptions } from "./tag-options-context";
import { TagOverlay } from "./tag-overlay";

const labelOf = (tag: Pick<TagSummary, "key" | "value">) => (tag.value === null ? tag.key : `${tag.key}:${tag.value}`);

type Change = { type: "attach"; tag: TagSummary } | { type: "detach"; tagId: number };

function applyChange(current: TagSummary[], change: Change): TagSummary[] {
  if (change.type === "detach") return current.filter((tag) => tag.id !== change.tagId);
  const replaced = tagIdsReplacedBy(current, change.tag);
  return [...current.filter((tag) => !replaced.includes(tag.id)), change.tag].sort((a, b) =>
    labelOf(a).localeCompare(labelOf(b), "id-ID"),
  );
}

/** Matches the typed text against `key:value` (the item's keyword), not the id used as cmdk's unique value. */
function filterTags(_value: string, search: string, keywords?: string[]): number {
  return (keywords ?? []).join(" ").includes(search.trim().toLowerCase()) ? 1 : 0;
}

/**
 * The entity's tags as chips with a remove button, and a combobox to add or remove usable tags: a popover from
 * `xl`, a bottom sheet below it (touch sizes). `attached` and `options` come from the server; changes show at
 * once and roll back with the server's message if the action fails.
 */
export function TagPicker({
  target,
  attached,
  options: optionsProp,
  canCreate: canCreateProp,
  compact = false,
  label,
}: {
  target: TagTarget;
  attached: TagSummary[];
  /** Usable tags grouped by owner (`listTags(...).usable`); defaults to the page's `TagOptionsProvider`. */
  options?: TagOwnerGroup[];
  /** ADMIN or OWNER: typing a new name offers "Buat tag" in the user's own group; defaults to the provider. */
  canCreate?: boolean;
  /** For table rows: chips are read-only and a small "+" opens the picker, where a tag is removed by choosing it again. */
  compact?: boolean;
  /** Names the entity for screen readers on a compact trigger ("Atur tag Ahmad Fauzi"). */
  label?: string;
}) {
  const provided = useTagOptions();
  const options = optionsProp ?? provided?.options ?? [];
  const canCreate = canCreateProp ?? provided?.canCreate ?? false;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [tags, applyOptimistic] = useOptimistic(attached, applyChange);

  const attachedIds = new Set(tags.map((tag) => tag.id));
  // Chips of visible but unusable tags (e.g. a descendant group's) stay read-only; the server would answer 403.
  const usableIds = new Set(options.flatMap((group) => group.tags.map((tag) => tag.id)));
  const parsed = parseTagInput(search);
  const knownLabels = new Set(options.flatMap((group) => group.tags.map(labelOf)));
  const createLabel = canCreate && search.trim() !== "" && parsed.ok && !knownLabels.has(labelOf(parsed)) ? labelOf(parsed) : null;

  function run(change: Change, call: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      applyOptimistic(change);
      const result = await call();
      if (!result.ok) setError(result.error ?? "Gagal mengubah tag");
    });
  }

  function toggle(tag: TagSummary) {
    const payload = { ...target, tagId: tag.id };
    if (attachedIds.has(tag.id)) run({ type: "detach", tagId: tag.id }, () => detachTagAction(payload));
    else run({ type: "attach", tag }, () => attachTagAction(payload));
  }

  function create() {
    if (!createLabel || !parsed.ok) return;
    const name = search;
    // Placeholder id until the server answers; the refreshed props replace it.
    const placeholder: TagSummary = { id: -1, groupId: -1, key: parsed.key, value: parsed.value, color: TAG_DEFAULT_COLOR };
    run({ type: "attach", tag: placeholder }, () => createAndAttachTagAction({ ...target, name }));
    setSearch("");
  }

  // No usable tag at all is a different message from a search without a match.
  const emptyText =
    options.length > 0 || search.trim() !== ""
      ? "Tidak ditemukan."
      : canCreate
        ? "Belum ada tag. Ketik nama untuk membuat tag."
        : "Belum ada tag yang bisa dipakai.";

  const panel = (
    <Command filter={filterTags} className="max-h-[70dvh] xl:max-h-80">
      <CommandInput value={search} onValueChange={setSearch} placeholder="Cari atau buat tag (kunci:nilai)" aria-label="Cari tag" />
      <CommandList className="pb-[env(safe-area-inset-bottom)]">
        <CommandEmpty>{emptyText}</CommandEmpty>
        {options.map(({ group, tags: groupTags }) => (
          <CommandGroup key={group.id} heading={group.isOwn ? "Grup sendiri" : group.name}>
            {groupTags.map((tag) => (
              <CommandItem key={tag.id} value={String(tag.id)} keywords={[labelOf(tag)]} onSelect={() => toggle(tag)}>
                <CheckIcon className={attachedIds.has(tag.id) ? "size-4 shrink-0" : "size-4 shrink-0 opacity-0"} aria-hidden />
                <TagChip tag={tag} wrap />
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {createLabel && (
          <CommandGroup forceMount>
            <CommandItem value="__create__" forceMount onSelect={create}>
              <PlusIcon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">Buat tag &quot;{createLabel}&quot;</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );

  const triggerLabel = compact && label ? `Atur tag ${label}` : "Atur tag";
  // A row with no tags yet gets a labelled button, aligned with the row's text; with chips, a bare "+" after them.
  const trigger = compact && tags.length === 0 ? (
    <Button type="button" variant="ghost" size="sm" className="-ml-3 text-muted-foreground xl:-ml-2.5" aria-label={triggerLabel} aria-haspopup="dialog" aria-expanded={open}>
      <PlusIcon aria-hidden />
      Tag
    </Button>
  ) : compact ? (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={triggerLabel} aria-haspopup="dialog" aria-expanded={open}>
      <PlusIcon aria-hidden />
    </Button>
  ) : (
    <Button type="button" variant="outline" aria-label={triggerLabel} aria-haspopup="dialog" aria-expanded={open}>
      <PlusIcon aria-hidden />
      Tag
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ul aria-label="Tag" className="contents">
        {tags.map((tag) => (
          <li key={tag.id} className="inline-flex max-w-full items-center">
            <TagChip tag={tag} wrap />
            {!compact && usableIds.has(tag.id) && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Hapus tag ${labelOf(tag)}`} onClick={() => run({ type: "detach", tagId: tag.id }, () => detachTagAction({ ...target, tagId: tag.id }))}>
                <XIcon aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <TagOverlay open={open} onOpenChange={setOpen} trigger={trigger} title="Atur tag" description="Pilih tag untuk dipasang atau dilepas.">
        {panel}
      </TagOverlay>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

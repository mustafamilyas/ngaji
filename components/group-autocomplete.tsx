"use client";

import { useMemo, useState } from "react";
import { Autocomplete, type AutocompleteItem } from "@/components/autocomplete";

export type GroupAutocompleteOption = { id: number; name: string; parentName?: string };

/** Adds `parentName` (shown as the hint) to groups that only carry `parentId`. */
export function withParentNames<T extends { id: number; name: string; parentId: number | null }>(
  groups: T[],
): GroupAutocompleteOption[] {
  const names = new Map(groups.map((g) => [g.id, g.name]));
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    parentName: g.parentId === null ? undefined : names.get(g.parentId),
  }));
}

/**
 * Type-to-search group picker — the control used on the check-in page, in
 * form-field size. The chosen id is reported via `onChange` (undefined while
 * the text is being edited) and mirrored in a hidden input when `name` is set,
 * so it also works in plain `<form action>` posts. The server still resolves
 * and scope-checks the id.
 */
export function GroupAutocomplete({
  id,
  label = "Grup",
  groups,
  value,
  onChange,
  name,
  placeholder = "Ketik nama grup",
  autoFocus,
  inlineList,
}: {
  id: string;
  label?: string;
  groups: GroupAutocompleteOption[];
  value: number | undefined;
  onChange: (groupId: number | undefined) => void;
  name?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** See `Autocomplete`: use inside dialogs. */
  inlineList?: boolean;
}) {
  const items = useMemo<AutocompleteItem[]>(
    () => groups.map((g) => ({ id: g.id, label: g.name, hint: g.parentName })),
    [groups],
  );
  const [query, setQuery] = useState(() => groups.find((g) => g.id === value)?.name ?? "");

  return (
    <>
      <Autocomplete
        id={id}
        label={label}
        items={items}
        query={query}
        onQueryChange={(text) => {
          setQuery(text);
          onChange(undefined);
        }}
        selectedId={value}
        onSelect={(item) => {
          setQuery(item.label);
          onChange(item.id);
        }}
        placeholder={placeholder}
        openOnFocus
        autoFocus={autoFocus}
        compact
        inlineList={inlineList}
      />
      {name && <input type="hidden" name={name} value={value ?? ""} />}
    </>
  );
}

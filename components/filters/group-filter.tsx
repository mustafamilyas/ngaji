"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, ListTree, Network, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { filterTriggerClass, submitFilterForm } from "./filter-bar";

export type FilterGroup = { id: number; parentId: number | null; name: string; path: string };

type Tree = {
  roots: FilterGroup[];
  childrenOf: Map<number, FilterGroup[]>;
  byId: Map<number, FilterGroup>;
};

function buildTree(groups: FilterGroup[]): Tree {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const childrenOf = new Map<number, FilterGroup[]>();
  const roots: FilterGroup[] = [];
  for (const group of groups) {
    if (group.parentId === null || !byId.has(group.parentId)) {
      roots.push(group);
      continue;
    }
    const siblings = childrenOf.get(group.parentId) ?? [];
    siblings.push(group);
    childrenOf.set(group.parentId, siblings);
  }
  return { roots, childrenOf, byId };
}

/** Ancestors of `group` that are in the tree (paths are `id/id/…/`). */
function ancestorIds(group: FilterGroup, byId: Map<number, FilterGroup>): number[] {
  return group.path
    .split("/")
    .filter(Boolean)
    .map(Number)
    .filter((id) => id !== group.id && byId.has(id));
}

/** Group name, prefixed with its parent's when the name alone is ambiguous (e.g. "Kelompok A" in every desa). */
function displayName(group: FilterGroup, tree: Tree, duplicateNames: Set<string>): string {
  if (!duplicateNames.has(group.name) || group.parentId === null) return group.name;
  const parent = tree.byId.get(group.parentId);
  return parent ? `${parent.name} › ${group.name}` : group.name;
}

function triggerLabel(selected: number[], tree: Tree, duplicateNames: Set<string>, emptyLabel: string) {
  const groups = selected.map((id) => tree.byId.get(id)).filter((g): g is FilterGroup => Boolean(g));
  if (groups.length === 0) return emptyLabel;
  const first = displayName(groups[0], tree, duplicateNames);
  return groups.length === 1 ? first : `${first} +${groups.length - 1}`;
}

/**
 * Group filter (`grup`): a popover with a searchable, collapsible tree of
 * the groups in scope. `multi` uses checkboxes and an explicit "Terapkan";
 * `single` applies on click. The chosen ids live in one hidden input inside
 * the surrounding `FilterBar` form (the popup itself is portaled out of it).
 */
export function GroupFilter({
  groups,
  selected: selectedProp,
  mode = "multi",
  emptyLabel = "Semua grup",
  hint,
  withDescendantsAction = false,
  active: activeProp,
  name = "grup",
}: {
  groups: FilterGroup[];
  selected: number[];
  mode?: "multi" | "single";
  /** Trigger text when nothing is selected (what the page shows by default). */
  emptyLabel?: string;
  /** One line under the search box explaining what a selection means on this page. */
  hint?: string;
  /** Offer "pilih dengan turunannya" — only useful where a group does NOT already include its descendants. */
  withDescendantsAction?: boolean;
  /** Override for the "filter applied" highlight, when `selected` is pre-filled with the page default. */
  active?: boolean;
  name?: string;
}) {
  const tree = useMemo(() => buildTree(groups), [groups]);
  const duplicateNames = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const g of groups) (seen.has(g.name) ? duplicates : seen).add(g.name);
    return duplicates;
  }, [groups]);
  const hiddenRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<number[]>(selectedProp);
  const [expanded, setExpanded] = useState<Set<number>>(() => initialExpanded(selectedProp));

  // Re-sync when the URL (and thus `selected`) changes under us.
  const selectedKey = selectedProp.join(",");
  const [prevKey, setPrevKey] = useState(selectedKey);
  if (selectedKey !== prevKey) {
    setPrevKey(selectedKey);
    setDraft(selectedProp);
  }

  function initialExpanded(ids: number[]) {
    const next = new Set(tree.roots.map((r) => r.id));
    for (const id of ids) {
      const group = tree.byId.get(id);
      if (group) ancestorIds(group, tree.byId).forEach((a) => next.add(a));
    }
    return next;
  }

  const needle = query.trim().toLocaleLowerCase("id-ID");
  const visible = useMemo(() => {
    if (!needle) return null;
    const keep = new Set<number>();
    for (const group of groups) {
      if (group.name.toLocaleLowerCase("id-ID").includes(needle)) {
        keep.add(group.id);
        ancestorIds(group, tree.byId).forEach((a) => keep.add(a));
      }
    }
    return keep;
  }, [needle, groups, tree]);

  function apply(ids: number[]) {
    if (hiddenRef.current) hiddenRef.current.value = ids.join(",");
    setOpen(false);
    submitFilterForm(hiddenRef.current);
  }

  function toggle(id: number) {
    if (mode === "single") {
      apply([id]);
      return;
    }
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectWithDescendants(group: FilterGroup) {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const g of groups) if (g.path.startsWith(group.path)) next.add(g.id);
      return [...next];
    });
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const draftSet = new Set(draft);
  const active = activeProp ?? selectedProp.length > 0;

  function renderNode(group: FilterGroup, depth: number): React.ReactNode {
    if (visible && !visible.has(group.id)) return null;
    const children = tree.childrenOf.get(group.id) ?? [];
    const isOpen = visible ? true : expanded.has(group.id);
    const checked = draftSet.has(group.id);
    const matches = needle && group.name.toLocaleLowerCase("id-ID").includes(needle);

    return (
      <li key={group.id} role="treeitem" aria-expanded={children.length > 0 ? isOpen : undefined} aria-selected={checked}>
        <div
          className="group/row flex items-center gap-1 rounded-md pr-1 hover:bg-muted"
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              aria-label={isOpen ? `Tutup ${group.name}` : `Buka ${group.name}`}
              onClick={() => toggleExpanded(group.id)}
              disabled={Boolean(visible)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-40 xl:size-6"
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="size-11 shrink-0 xl:size-6" />
          )}
          <button
            type="button"
            onClick={() => toggle(group.id)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-base xl:min-h-0 xl:text-sm"
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center border transition-colors",
                mode === "single" ? "rounded-full" : "rounded",
                checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
              )}
            >
              {checked && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className={cn("truncate", matches && "font-medium")}>{group.name}</span>
          </button>
          {mode === "multi" && withDescendantsAction && children.length > 0 && (
            <button
              type="button"
              title="Pilih dengan turunannya"
              aria-label={`Pilih ${group.name} dengan turunannya`}
              onClick={() => selectWithDescendants(group)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 group-hover/row:opacity-100 hover:bg-background hover:text-foreground focus-visible:opacity-100 xl:size-7"
            >
              <ListTree className="size-4" />
            </button>
          )}
        </div>
        {children.length > 0 && isOpen && <ul role="group">{children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  }

  return (
    <>
      {/* A pre-filled page default (`active={false}`) is not submitted, so the URL only carries real choices. */}
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        defaultValue={activeProp === false ? "" : selectedKey}
        key={`${selectedKey}:${activeProp}`}
      />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setDraft(selectedProp);
            setQuery("");
            setExpanded(initialExpanded(selectedProp));
          }
        }}
      >
        <PopoverTrigger className={filterTriggerClass(active)}>
          <Network className="size-4 text-muted-foreground" />
          <span className="max-w-56 truncate">{triggerLabel(selectedProp, tree, duplicateNames, emptyLabel)}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent
          className="flex w-[min(22rem,calc(100vw-24px))] flex-col"
          // Don't pop the on-screen keyboard on phones; desktop users can type to search right away.
          initialFocus={(openType) => openType !== "touch"}
        >
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari grup…"
                aria-label="Cari grup"
                className="h-11 w-full rounded-md border border-input bg-background pr-2 pl-8 text-base outline-none focus-visible:border-ring xl:h-8 xl:text-sm"
              />
            </div>
            {hint && <p className="mt-1.5 px-0.5 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <ul role="tree" aria-multiselectable={mode === "multi"} className="max-h-72 overflow-y-auto p-1">
            {tree.roots.map((root) => renderNode(root, 0))}
            {visible && visible.size === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">Grup tidak ditemukan.</li>
            )}
          </ul>
          {mode === "multi" && (
            <div className="flex items-center justify-between gap-2 border-t p-2">
              <button
                type="button"
                onClick={() => setDraft([])}
                disabled={draft.length === 0}
                className="h-11 rounded-md px-3 text-base text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 xl:h-8 xl:px-2 xl:text-sm"
              >
                Kosongkan
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{draft.length} dipilih</span>
                <button
                  type="button"
                  onClick={() => apply(draft)}
                  className="h-11 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary/80 xl:h-8 xl:px-3 xl:text-sm"
                >
                  Terapkan
                </button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

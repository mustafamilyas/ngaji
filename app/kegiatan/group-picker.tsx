"use client";

import { useEffect, useState } from "react";

export type PickerGroup = { id: number; parentId: number | null; name: string; path: string };

function GroupPickerNode({
  group,
  childrenByParent,
  selected,
  onToggle,
  onSelectWithDescendants,
}: {
  group: PickerGroup;
  childrenByParent: Map<number, PickerGroup[]>;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectWithDescendants: (group: PickerGroup) => void;
}) {
  const children = childrenByParent.get(group.id) ?? [];
  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={selected.has(group.id)} onChange={() => onToggle(group.id)} />
          {group.name}
        </label>
        <button
          type="button"
          onClick={() => onSelectWithDescendants(group)}
          className="text-xs text-primary hover:underline"
        >
          pilih dengan turunannya
        </button>
      </div>
      {children.length > 0 && (
        <ul className="ml-4 border-l pl-2">
          {children.map((child) => (
            <GroupPickerNode
              key={child.id}
              group={child}
              childrenByParent={childrenByParent}
              selected={selected}
              onToggle={onToggle}
              onSelectWithDescendants={onSelectWithDescendants}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Checkbox tree group filter (same nested parent/child shape as `/grup`).
 * Selection is tracked client-side and mirrored into a single hidden `grup`
 * input (comma-separated ids) so the surrounding `<form method="get">`
 * submits it like any other filter — no client fetch.
 */
export function GroupPicker({ groups, initialSelected }: { groups: PickerGroup[]; initialSelected: number[] }) {
  const [selected, setSelected] = useState<number[]>(initialSelected);
  const initialSelectedKey = initialSelected.join(",");

  // `/kegiatan` navigations only change `searchParams` on the same route, so
  // this Client Component isn't remounted — resync to the server-computed
  // selection whenever the URL (and thus this prop) changes.
  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelectedKey]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectWithDescendants(group: PickerGroup) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const g of groups) {
        if (g.id === group.id || g.path.startsWith(group.path)) next.add(g.id);
      }
      return [...next];
    });
  }

  const groupIds = new Set(groups.map((g) => g.id));
  const root = groups.find((g) => g.parentId === null || !groupIds.has(g.parentId));

  const childrenByParent = new Map<number, PickerGroup[]>();
  for (const group of groups) {
    if (group.parentId === null || !groupIds.has(group.parentId)) continue;
    const siblings = childrenByParent.get(group.parentId) ?? [];
    siblings.push(group);
    childrenByParent.set(group.parentId, siblings);
  }

  const selectedSet = new Set(selected);

  return (
    <div className="flex flex-col gap-1 rounded-md border p-2">
      <input type="hidden" name="grup" value={selected.join(",")} />
      <p className="text-xs text-muted-foreground">Grup</p>
      <div className="max-h-56 overflow-y-auto">
        {root ? (
          <ul>
            <GroupPickerNode
              group={root}
              childrenByParent={childrenByParent}
              selected={selectedSet}
              onToggle={toggle}
              onSelectWithDescendants={selectWithDescendants}
            />
          </ul>
        ) : (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Grup tidak ditemukan.</p>
        )}
      </div>
    </div>
  );
}

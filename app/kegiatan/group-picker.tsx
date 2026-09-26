"use client";

import { useEffect, useState } from "react";

export type PickerGroup = { id: number; name: string; path: string };

/** Indentation depth from a materialized path ("1/5/12/" -> depth 2). */
function depthOf(path: string): number {
  return path.split("/").filter(Boolean).length - 1;
}

/**
 * Checkbox-tree group filter. Selection is tracked client-side and mirrored
 * into a single hidden `grup` input (comma-separated ids) so the surrounding
 * `<form method="get">` submits it like any other filter — no client fetch.
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

  return (
    <div className="flex flex-col gap-1 rounded-md border p-2">
      <input type="hidden" name="grup" value={selected.join(",")} />
      <p className="text-xs text-muted-foreground">Grup</p>
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {groups.map((g) => (
          <div
            key={g.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
            style={{ paddingLeft: depthOf(g.path) * 14 }}
          >
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={selected.includes(g.id)} onChange={() => toggle(g.id)} />
              {g.name}
            </label>
            <button
              type="button"
              onClick={() => selectWithDescendants(g)}
              className="text-xs text-primary hover:underline"
            >
              pilih dengan turunannya
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

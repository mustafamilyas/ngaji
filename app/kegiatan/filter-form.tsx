"use client";

import { useEffect, useState } from "react";
import { GroupPicker, type PickerGroup } from "./group-picker";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function FilterForm({
  groups,
  initialSelectedGroupIds,
  range,
  anchor,
  from,
  to,
  view,
}: {
  groups: PickerGroup[];
  initialSelectedGroupIds: number[];
  range: string;
  anchor: string;
  from: string;
  to: string;
  view: string;
}) {
  const [mode, setMode] = useState(range);

  // `/kegiatan` navigations only change `searchParams` on the same route, so
  // this Client Component isn't remounted — resync local UI state to the
  // server-computed props whenever the URL (and thus these props) changes.
  useEffect(() => {
    setMode(range);
  }, [range]);

  return (
    <form className="flex flex-col gap-3" method="get">
      <input type="hidden" name="view" value={view} />
      {mode !== "custom" && <input type="hidden" name="anchor" value={anchor} />}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="range" className="text-xs text-muted-foreground">
            Rentang
          </label>
          <select id="range" name="range" value={mode} onChange={(e) => setMode(e.target.value)} className={inputClass}>
            <option value="hari">Hari ini</option>
            <option value="minggu">Minggu ini</option>
            <option value="bulan">Bulan ini</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {mode === "custom" && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="from" className="text-xs text-muted-foreground">
                Dari
              </label>
              <input id="from" type="date" name="from" defaultValue={from} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="to" className="text-xs text-muted-foreground">
                Sampai
              </label>
              <input id="to" type="date" name="to" defaultValue={to} className={inputClass} />
            </div>
          </>
        )}

        <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted">
          Tampilkan
        </button>
      </div>

      <GroupPicker groups={groups} initialSelected={initialSelectedGroupIds} />
    </form>
  );
}

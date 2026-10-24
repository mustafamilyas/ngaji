"use client";

import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { SortDir, SortState } from "@/lib/sort";
import { cn } from "@/lib/utils";
import { filterTriggerClass, submitFilterForm } from "./filter-bar";

export type SortOption = { key: string; label: string };

/**
 * Sort control for phones, where the table headers (the sort links) are
 * hidden below `md`. It lives inside a `FilterBar` form and speaks the same
 * `?sort=` / `?dir=` contract as the header links (see `lib/sort.ts`): its two
 * hidden fields carry the current order (empty for the default, which the form
 * then leaves out of the URL), so the page does not also pass `sortPreserve`.
 */
export function SortSelect<K extends string>({
  options,
  current,
  fallback,
}: {
  options: readonly SortOption[];
  current: SortState<K>;
  fallback: SortState<K>;
}) {
  const sortRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const isDefault = current.key === fallback.key && current.dir === fallback.dir;

  function change(event: React.ChangeEvent<HTMLSelectElement>) {
    const [key, dir] = event.target.value.split(":") as [string, SortDir];
    const toDefault = key === fallback.key && dir === fallback.dir;
    if (sortRef.current) sortRef.current.value = toDefault ? "" : key;
    if (dirRef.current) dirRef.current.value = toDefault ? "" : dir;
    submitFilterForm(event.target);
  }

  return (
    <div className="relative w-full sm:w-auto md:hidden">
      <input ref={sortRef} type="hidden" name="sort" defaultValue={isDefault ? "" : current.key} />
      <input ref={dirRef} type="hidden" name="dir" defaultValue={isDefault ? "" : current.dir} />
      <select
        aria-label="Urutkan"
        defaultValue={`${current.key}:${current.dir}`}
        key={`${current.key}:${current.dir}`}
        onChange={change}
        className={cn(filterTriggerClass(!isDefault), "w-full appearance-none pr-8")}
      >
        {options.flatMap((option) => [
          <option key={`${option.key}:asc`} value={`${option.key}:asc`}>
            Urutkan: {option.label} (naik)
          </option>,
          <option key={`${option.key}:desc`} value={`${option.key}:desc`}>
            Urutkan: {option.label} (turun)
          </option>,
        ])}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

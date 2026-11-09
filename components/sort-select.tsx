"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { filterTriggerClass } from "@/components/filters/filter-bar";
import { cn } from "@/lib/utils";

/**
 * Phone-only sort control (the column headers are hidden below md). The server computes every option's href, so
 * this only navigates; keeping the URL as the single source of the order.
 */
export function SortSelect({
  options,
  value,
  label = "Urutkan",
}: {
  options: { value: string; label: string; href: string }[];
  value: string;
  /** Accessible name; a page with two sortable tables names each. */
  label?: string;
}) {
  const router = useRouter();
  return (
    <div className="relative md:hidden">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          const next = options.find((o) => o.value === event.target.value);
          if (next) router.push(next.href, { scroll: false });
        }}
        className={cn(filterTriggerClass(), "w-full appearance-none pr-8")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            Urutkan: {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

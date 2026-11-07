"use client";

import { useFormStatus } from "react-dom";
import { Check, Columns3, Loader2 } from "lucide-react";
import { filterTriggerClass } from "@/components/filters/filter-bar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function SavingIndicator() {
  const { pending } = useFormStatus();
  return pending ? <Loader2 aria-label="Menyimpan" className="size-3.5 animate-spin text-muted-foreground" /> : null;
}

/**
 * "Kolom" picker for a table: each checkbox change submits `action` (a
 * Server Action that stores the choice and refreshes the route), so the
 * server re-renders only the chosen columns. The popover stays open while
 * the user toggles several columns.
 */
export function ColumnToggle({
  columns,
  visible,
  action,
  name = "kolom",
}: {
  columns: readonly { key: string; label: string }[];
  visible: readonly string[];
  action: (formData: FormData) => Promise<void>;
  name?: string;
}) {
  const visibleSet = new Set(visible);

  return (
    <Popover>
      <PopoverTrigger className={filterTriggerClass()}>
        <Columns3 className="size-4 text-muted-foreground" />
        Kolom
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(16rem,calc(100vw-24px))]">
        {/* Portaled in the DOM, but React bubbles `submit` through the component tree: stop it here so a
            surrounding filter form (e.g. FilterBar's panel) does not submit too. */}
        <form action={action} key={visible.join(",")} onSubmit={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Tampilkan kolom</p>
            <SavingIndicator />
          </div>
          <ul className="max-h-80 overflow-y-auto p-1">
            {columns.map((column) => (
              <li key={column.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2.5 text-base hover:bg-muted xl:py-1.5 xl:text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring/50">
                  <input
                    type="checkbox"
                    name={name}
                    value={column.key}
                    defaultChecked={visibleSet.has(column.key)}
                    onChange={(event) => event.currentTarget.form?.requestSubmit()}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border border-input bg-background text-transparent transition-colors",
                      "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {column.label}
                </label>
              </li>
            ))}
          </ul>
        </form>
      </PopoverContent>
    </Popover>
  );
}

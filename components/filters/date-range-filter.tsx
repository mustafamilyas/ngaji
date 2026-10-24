"use client";

import { useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DATE_RANGE_LABELS,
  formatDateRange,
  shiftDateRange,
  type DateRange,
  type DateRangeMode,
} from "@/lib/filters";
import { isDateString } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { filterTriggerClass, submitFilterForm } from "./filter-bar";

type Fields = { range: string; anchor: string; from: string; to: string };
const FIELD_NAMES = ["range", "anchor", "from", "to"] as const satisfies readonly (keyof Fields)[];

/**
 * Date range filter (`range` / `anchor` / `from` / `to`, see
 * `lib/filters.ts`): preset periods, a custom from–to, and previous/next
 * buttons that step by the current range's size.
 */
export function DateRangeFilter({
  range,
  modes,
  defaultMode,
  today,
}: {
  range: DateRange;
  modes: readonly DateRangeMode[];
  defaultMode: DateRangeMode;
  /** Server's "today" in the organization timezone, so the label matches what the server computed. */
  today: string;
}) {
  const formRef = useRef<HTMLSpanElement>(null);

  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(range.from ?? "");
  const [customTo, setCustomTo] = useState(range.to ?? "");

  const current: Fields = {
    range: range.mode,
    anchor: range.mode !== "custom" && range.anchor !== today ? range.anchor : "",
    from: range.mode === "custom" ? (range.from ?? "") : "",
    to: range.mode === "custom" ? (range.to ?? "") : "",
  };
  const stateKey = Object.values(current).join("|");

  function submit(next: Partial<Fields>) {
    const fields = { ...current, ...next };
    for (const name of FIELD_NAMES) {
      const input = formRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (input) input.value = fields[name];
    }
    setOpen(false);
    submitFilterForm(formRef.current);
  }

  function step(direction: 1 | -1) {
    const shifted = shiftDateRange(range, direction);
    if (shifted) submit(shifted);
  }

  const canStep = shiftDateRange(range, 1) !== null;
  const isPresetNow = range.mode !== "custom" && range.anchor === today;
  const dates = formatDateRange(range.from, range.to);
  const presets = modes.filter((m) => m !== "custom");
  const customValid = (!customFrom || isDateString(customFrom)) && (!customTo || isDateString(customTo)) && (customFrom || customTo);

  return (
    <span ref={formRef} className="inline-flex max-w-full items-center">
      {FIELD_NAMES.map((name) => (
        <input key={`${name}:${stateKey}`} type="hidden" name={name} defaultValue={current[name]} />
      ))}

      <span className="inline-flex max-w-full items-center rounded-lg">
        {canStep && (
          <button
            type="button"
            aria-label="Rentang sebelumnya"
            onClick={() => step(-1)}
            className={cn(filterTriggerClass(), "min-w-11 justify-center rounded-r-none border-r-0 px-2 xl:min-w-0")}
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              setCustomFrom(range.from ?? "");
              setCustomTo(range.to ?? "");
            }
          }}
        >
          <PopoverTrigger
            className={cn(filterTriggerClass(range.mode !== defaultMode || !isPresetNow), canStep && "rounded-none")}
          >
            <CalendarDays className="size-4 text-muted-foreground" />
            {isPresetNow ? (
              <span className="truncate">
                {DATE_RANGE_LABELS[range.mode]}
                {range.mode !== "semua" && <span className="hidden text-muted-foreground sm:inline"> · {dates}</span>}
              </span>
            ) : (
              <span className="truncate">{dates}</span>
            )}
            <ChevronDown className="size-4 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-[min(18rem,calc(100vw-24px))]">
            <ul className="p-1">
              {presets.map((mode) => {
                const selected = range.mode === mode && isPresetNow;
                return (
                  <li key={mode}>
                    <button
                      type="button"
                      onClick={() => submit({ range: mode, anchor: "", from: "", to: "" })}
                      className="flex min-h-11 w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-base hover:bg-muted xl:min-h-0 xl:text-sm"
                    >
                      {DATE_RANGE_LABELS[mode]}
                      {selected && <Check className="size-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {modes.includes("custom") && (
              <div className="flex flex-col gap-2 border-t p-3">
                <p className="text-xs font-medium text-muted-foreground">{DATE_RANGE_LABELS.custom}</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Dari
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={(event) => setCustomFrom(event.target.value)}
                      className="h-11 rounded-md border border-input bg-background px-2 text-base text-foreground outline-none focus-visible:border-ring xl:h-8 xl:text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Sampai
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(event) => setCustomTo(event.target.value)}
                      className="h-11 rounded-md border border-input bg-background px-2 text-base text-foreground outline-none focus-visible:border-ring xl:h-8 xl:text-sm"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={!customValid}
                  onClick={() => submit({ range: "custom", anchor: "", from: customFrom, to: customTo })}
                  className="h-11 rounded-md bg-primary px-3 text-base font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50 xl:h-8 xl:text-sm"
                >
                  Terapkan
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        {canStep && (
          <button
            type="button"
            aria-label="Rentang berikutnya"
            onClick={() => step(1)}
            className={cn(filterTriggerClass(), "min-w-11 justify-center rounded-l-none border-l-0 px-2 xl:min-w-0")}
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </span>
    </span>
  );
}

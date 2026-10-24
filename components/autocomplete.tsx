"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type AutocompleteItem = { id: number; label: string; hint?: string; badge?: string };

const LIMIT = 8;

export const autocompleteCompactInputClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none transition-colors xl:h-9 xl:text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60";

export const autocompleteInputClass =
  "h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Type-to-filter picker: suggestions show while typing (and on focus when
 * `openOnFocus`), ↑/↓/Enter pick one, editing the text clears the choice.
 * `query` is controlled by the parent so it can prefill or reset it.
 */
export function Autocomplete({
  id,
  label,
  items,
  emptyItems,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  placeholder,
  disabled,
  openOnFocus = false,
  inputRef,
  autoFocus,
  prefix,
  compact = false,
}: {
  id: string;
  label: string;
  items: AutocompleteItem[];
  /** Suggestions while the text is empty (default: `items`); typing searches all of `items`. */
  emptyItems?: AutocompleteItem[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: number | undefined;
  onSelect: (item: AutocompleteItem) => void;
  placeholder?: string;
  disabled?: boolean;
  openOnFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  /** Shown between the label and the input (e.g. the ancestry of the group being chosen). */
  prefix?: React.ReactNode;
  /** Form-field sizing (like the other inputs in a form) instead of the large kiosk sizing. */
  compact?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const needle = query.trim().toLocaleLowerCase("id-ID");
  const open = focused && selectedId === undefined && (needle !== "" || openOnFocus);
  const matches = open
    ? needle === ""
      ? (emptyItems ?? items).slice(0, LIMIT)
      : items
          .filter((item) => `${item.hint ?? ""} ${item.label}`.toLocaleLowerCase("id-ID").includes(needle))
          .slice(0, LIMIT)
    : [];
  const notFound = open && needle !== "" && matches.length === 0;

  function pick(item: AutocompleteItem) {
    onSelect(item);
    setHighlight(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(matches[highlight] ?? matches[0]);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {prefix}
      {/* The list floats over the content below instead of pushing it down. */}
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setHighlight(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          className={compact ? autocompleteCompactInputClass : autocompleteInputClass}
        />
        {(matches.length > 0 || notFound) && (
          <ul
            id={`${id}-list`}
            role="listbox"
            className={cn(
              "absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto border bg-background shadow-lg",
              compact ? "rounded-md" : "rounded-xl",
            )}
          >
            {notFound && <li className={cn("text-sm text-muted-foreground", compact ? "px-3 py-2" : "px-4 py-3")}>Tidak ditemukan.</li>}
            {matches.map((item, i) => (
              <li key={item.id} role="option" aria-selected={i === highlight}>
                {/* mousedown (not click) so the input's blur doesn't close the list before the pick lands */}
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(item);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 text-left hover:bg-muted",
                    compact ? "min-h-11 px-3 py-2 text-base xl:min-h-0 xl:text-sm" : "px-4 py-3 text-base",
                    i === highlight && "bg-muted",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    {item.hint && <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>}
                  </span>
                  {item.badge && <span className="shrink-0 text-xs text-muted-foreground">{item.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

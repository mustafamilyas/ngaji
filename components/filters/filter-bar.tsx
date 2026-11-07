"use client";

import { useEffect, useId, useRef, useState } from "react";
import Form from "next/form";
import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared look of every filter control's trigger; `active` = the filter narrows the list. */
export function filterTriggerClass(active = false) {
  return cn(
    "inline-flex h-11 max-w-full items-center gap-1.5 rounded-lg border bg-background px-3 text-base whitespace-nowrap xl:h-9 xl:text-sm transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    active && "border-primary/40 bg-primary/5 hover:bg-primary/10",
  );
}

/** Submits the filter form that contains `element` (popups are portaled, so callers pass an in-form element). */
export function submitFilterForm(element: HTMLElement | null) {
  const form = element?.closest("form");
  if (form) form.requestSubmit();
}

/**
 * Standard list filter: a GET form (via `next/form`, so it navigates
 * client-side) whose fields are the URL contract parsed by `lib/filters.ts`.
 * Controls submit on change; empty fields are left out of the URL, and the
 * page number is never carried over, so any filter change goes back to page 1.
 */
export function FilterBar({
  action,
  preserve,
  isFiltered,
  resetHref,
  more,
  activeCount = 0,
  children,
}: {
  action: string;
  /** Non-filter params to keep across submits (e.g. the active tab or view). */
  preserve?: Record<string, string | undefined>;
  isFiltered: boolean;
  resetHref: string;
  /** Secondary controls: a bottom panel behind a "Filter" button below `lg`, inline from `lg`. */
  more?: React.ReactNode;
  /** Secondary filters in effect (one per filter; search and sort do not count). */
  activeCount?: number;
  /** Primary controls, always inline (e.g. search). */
  children?: React.ReactNode;
}) {
  function dropEmptyFields(event: React.FormEvent<HTMLFormElement>) {
    const disabled: (HTMLInputElement | HTMLSelectElement)[] = [];
    for (const element of Array.from(event.currentTarget.elements)) {
      if (
        (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) &&
        element.name &&
        !element.disabled &&
        element.value === ""
      ) {
        element.disabled = true;
        disabled.push(element);
      }
    }
    // FormData is built synchronously right after this handler; re-enable on the next tick.
    setTimeout(() => disabled.forEach((element) => (element.disabled = false)));
  }

  return (
    <Form
      action={action}
      scroll={false}
      onSubmit={dropEmptyFields}
      role="search"
      className="flex flex-wrap items-center gap-2"
    >
      {preserve &&
        Object.entries(preserve).map(([name, value]) =>
          value ? <input key={name} type="hidden" name={name} value={value} /> : null,
        )}
      {children}
      {more && (
        <FilterPanel activeCount={activeCount} reset={isFiltered && <ResetLink href={resetHref} className="lg:hidden" />}>
          {more}
        </FilterPanel>
      )}
      {/* With a panel, the inline Reset shows below `lg` only when search alone filters; otherwise it is in the panel. */}
      {isFiltered && <ResetLink href={resetHref} className={more && activeCount > 0 ? "hidden lg:inline-flex" : undefined} />}
    </Form>
  );
}

function ResetLink({ href, className }: { href: string; className?: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex h-11 items-center gap-1 rounded-lg px-2 text-base text-muted-foreground hover:bg-muted hover:text-foreground xl:h-9 xl:text-sm",
        className,
      )}
    >
      <X className="size-4" />
      Reset
    </Link>
  );
}

/**
 * Below `lg`: a "Filter" button opening a bottom panel. From `lg` the panel is
 * `display: contents`, so its controls sit inline. It is rendered inside the
 * form (not a portaled Sheet) so its controls still submit it; popovers (z-50)
 * open above it (z-40).
 */
function FilterPanel({
  activeCount,
  reset,
  children,
}: {
  activeCount: number;
  reset: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    panel.focus();
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    // A DOM listener on the panel, so Escape inside a portaled popover closes only that popover.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    panel.addEventListener("keydown", onKeyDown);
    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className={cn(filterTriggerClass(activeCount > 0), "lg:hidden")}
      >
        <SlidersHorizontal className="size-4" />
        {activeCount > 0 ? `Filter (${activeCount})` : "Filter"}
      </button>
      {open && <div data-filter-backdrop aria-hidden className="fixed inset-0 z-40 bg-black/10 lg:hidden" onClick={close} />}
      <div
        ref={panelRef}
        id={panelId}
        data-filter-panel
        tabIndex={-1}
        {...(open && { role: "dialog", "aria-label": "Filter" })}
        className={cn(
          open
            ? "fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-xl border-t bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-lg outline-none"
            : "hidden",
          "lg:contents",
        )}
      >
        <div className="flex items-center justify-between lg:hidden">
          <h2 className="text-base font-medium">Filter</h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={close}
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:contents">{children}</div>
        {reset}
      </div>
    </>
  );
}

const SEARCH_DEBOUNCE_MS = 400;

/** Name search (`q`): submits after the user pauses typing, or on Enter. */
export function SearchFilter({
  value,
  placeholder = "Cari nama…",
  name = "q",
}: {
  value: string | undefined;
  placeholder?: string;
  name?: string;
}) {
  const [text, setText] = useState(value ?? "");
  const [prevValue, setPrevValue] = useState(value);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow URL changes (e.g. Reset) without clobbering what the user is typing.
  if (value !== prevValue) {
    setPrevValue(value);
    if (!focused) setText(value ?? "");
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function schedule(next: string) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next.trim() !== (value ?? "")) submitFilterForm(inputRef.current);
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="relative min-w-48 flex-1 sm:w-64 sm:flex-none">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        name={name}
        value={text}
        onChange={(event) => schedule(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") clearTimeout(timer.current);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-input bg-background pr-11 pl-9 text-base outline-none xl:h-9 xl:pr-8 xl:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          aria-label="Hapus pencarian"
          onClick={() => {
            clearTimeout(timer.current);
            setText("");
            // Let React flush the cleared value into the input before submitting.
            setTimeout(() => submitFilterForm(inputRef.current));
          }}
          className="absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 xl:right-2 xl:size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Single-choice page-specific filter (status, action, actor…) as a native select styled like the other triggers. */
export function SelectFilter({
  name,
  value,
  label,
  allLabel,
  options,
}: {
  name: string;
  value: string | undefined;
  /** Accessible name, e.g. "Status". */
  label: string;
  /** Option shown when the filter is off, e.g. "Semua status". */
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        name={name}
        defaultValue={value ?? ""}
        key={value ?? ""}
        aria-label={label}
        onChange={(event) => submitFilterForm(event.currentTarget)}
        className={cn(filterTriggerClass(Boolean(value)), "appearance-none pr-8")}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

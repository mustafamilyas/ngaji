import { useRef, useState } from "react";

/**
 * Local copy of a value while a panel is open (task 6.1): `begin` on open,
 * `edit` while open, `commit` on close or "Terapkan" calls `apply` once, and
 * only when something changed. Outside a panel `value` is `applied`.
 */
export function useDraft<T>(applied: T, apply: (next: T) => void) {
  const [draft, setDraft] = useState<T | null>(null);
  // Read in `commit`, which can run right after a blur's `edit` in the same event, before a re-render.
  const latest = useRef<T | null>(null);
  const set = (next: T | null) => {
    latest.current = next;
    setDraft(next);
  };

  return {
    value: draft ?? applied,
    isOpen: draft !== null,
    begin: (start: T = applied) => set(start),
    edit: (next: T) => {
      if (latest.current !== null) set(next);
    },
    cancel: () => set(null),
    commit: () => {
      // Text inputs report their value on blur; blur first so a value still being typed is kept.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const next = latest.current;
      set(null);
      if (next !== null && next !== applied) apply(next);
    },
  };
}

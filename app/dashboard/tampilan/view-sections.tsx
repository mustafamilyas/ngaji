"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { MemberColumnKey } from "@/lib/member/columns";
import type { SectionView } from "@/lib/member-view/sections";
import { loadSectionAction } from "./actions";
import { ViewMembersTable, type ViewMemberRow } from "./view-table";

type SectionState = {
  key: string;
  label: string;
  count: number;
  expanded: boolean;
  loaded: boolean;
  members: ViewMemberRow[];
  hasMore: boolean;
};

const STORAGE_PREFIX = "tampilan_collapsed:";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Raw stored string; a string snapshot keeps `useSyncExternalStore` stable between renders. */
function readRaw(storageKey: string): string {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + storageKey) ?? "";
  } catch {
    return "";
  }
}

function parseCollapsed(raw: string): Record<string, boolean> {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeCollapsed(storageKey: string, value: Record<string, boolean>) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the state just isn't remembered.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Collapsible grouped results. The server decides the initial state (first
 * sections expanded and loaded); collapsed sections load their first page on
 * first expand and later pages via "Tampilkan lebih banyak", both through
 * `loadSectionAction`. Expanded/collapsed choices are per viewer (localStorage).
 */
export function ViewSections({
  sections: initial,
  columns,
  asOf,
  viewId,
  draft,
}: {
  sections: SectionView[];
  columns: MemberColumnKey[];
  asOf: string;
  viewId: number | null;
  draft?: string;
}) {
  const storageKey = viewId === null ? "baru" : String(viewId);
  const [sections, setSections] = useState<SectionState[]>(() =>
    initial.map((s) => ({ ...s, members: s.members as unknown as ViewMemberRow[] })),
  );
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Server snapshot is "" so hydration matches the server render; remembered choices apply right after.
  const raw = useSyncExternalStore(subscribe, () => readRaw(storageKey), () => "");
  const remembered = parseCollapsed(raw);

  function load(key: string, offset: number) {
    setError(null);
    setLoadingKey(key);
    startTransition(async () => {
      const result = await loadSectionAction({ viewId, draft, key, offset });
      setLoadingKey(null);
      if (!result.ok) {
        setError("Gagal memuat anggota. Muat ulang halaman lalu coba lagi.");
        return;
      }
      const { members, hasMore } = result.data;
      setSections((current) =>
        current.map((s) =>
          s.key === key
            ? { ...s, loaded: true, hasMore, members: offset === 0 ? (members as unknown as ViewMemberRow[]) : [...s.members, ...(members as unknown as ViewMemberRow[])] }
            : s,
        ),
      );
    });
  }

  const isExpanded = (section: SectionState) => (section.key in remembered ? !remembered[section.key] : section.expanded);

  function toggle(section: SectionState) {
    const expanded = !isExpanded(section);
    writeCollapsed(storageKey, { ...remembered, [section.key]: !expanded });
    if (expanded && !section.loaded) load(section.key, 0);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {sections.map((section) => {
        const expanded = isExpanded(section);
        return (
        <section key={section.key} className="overflow-hidden rounded-xl border bg-card">
          <h2>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggle(section)}
              className="flex min-h-11 w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted"
            >
              {expanded ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
              {section.label}
              <span className="ml-auto text-muted-foreground">{section.count} anggota</span>
            </button>
          </h2>
          {expanded && (
            <div className="border-t">
              {section.members.length > 0 && <ViewMembersTable members={section.members} columns={columns} asOf={asOf} />}
              {loadingKey === section.key && section.members.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Memuat…</p>
              )}
              {section.loaded && section.hasMore && (
                <div className="border-t p-3 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loadingKey === section.key}
                    onClick={() => load(section.key, section.members.length)}
                  >
                    {loadingKey === section.key ? "Memuat…" : "Tampilkan lebih banyak"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
        );
      })}
    </div>
  );
}

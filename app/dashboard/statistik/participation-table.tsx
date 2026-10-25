"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { SortIcon } from "@/components/data-table";
import { filterTriggerClass } from "@/components/filters/filter-bar";
import { Pagination } from "@/components/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { paginate } from "@/lib/pagination";
import type { ParticipationRow } from "@/lib/stats";
import { cn } from "@/lib/utils";

type SortKey = keyof Pick<ParticipationRow, "memberName" | "occurrenceCount" | "hadir" | "izin" | "percentHadir">;

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "memberName", label: "Nama" },
  { key: "occurrenceCount", label: "Occurrence", align: "right" },
  { key: "hadir", label: "Hadir", align: "right" },
  { key: "izin", label: "Izin", align: "right" },
  { key: "percentHadir", label: "% Hadir", align: "right" },
];

export function ParticipationTable({ rows, pageSize = PAGE_SIZE }: { rows: ParticipationRow[]; pageSize?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("percentHadir");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(1);

  // New data (filter/range change) starts again from the first page.
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setPage(1);
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return descending ? -cmp : cmp;
    });
    return copy;
  }, [rows, sortKey, descending]);

  const visible = paginate(sorted, page, pageSize);

  function toggleSort(key: SortKey) {
    setPage(1);
    if (key === sortKey) {
      setDescending((d) => !d);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  }

  const cell = "flex items-center justify-between gap-3 text-sm md:table-cell md:py-2 md:text-right";

  return (
    <div className="flex flex-col gap-3">
      {/* Below md the table headers are hidden, so sorting moves into a select (same state as the headers). */}
      <div className="relative md:hidden">
        <select
          aria-label="Urutkan"
          value={`${sortKey}:${descending ? "desc" : "asc"}`}
          onChange={(event) => {
            const [key, dir] = event.target.value.split(":");
            setSortKey(key as SortKey);
            setDescending(dir === "desc");
            setPage(1);
          }}
          className={cn(filterTriggerClass(), "w-full appearance-none pr-8")}
        >
          {COLUMNS.flatMap((col) => [
            <option key={`${col.key}:asc`} value={`${col.key}:asc`}>
              Urutkan: {col.label} (naik)
            </option>,
            <option key={`${col.key}:desc`} value={`${col.key}:desc`}>
              Urutkan: {col.label} (turun)
            </option>,
          ])}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <div className="relative overflow-x-auto">
        <table className="block w-full text-sm md:table">
          <thead className="hidden md:table-header-group">
            <tr className="border-b text-xs text-muted-foreground">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
                    className={col.align === "right" ? "py-2 text-right" : "py-2 text-left"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1 hover:text-foreground xl:min-h-0",
                        active && "text-foreground",
                      )}
                    >
                      {col.label}
                      <SortIcon dir={active ? (descending ? "desc" : "asc") : undefined} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {visible.items.map((row) => (
              <tr
                key={row.memberId}
                className="grid grid-cols-2 gap-x-4 gap-y-1 border-b py-3 last:border-0 md:table-row md:p-0"
              >
                <td className="col-span-2 block md:table-cell md:py-2">
                  <Link
                    href={`/dashboard/anggota/${row.memberId}`}
                    className="inline-flex min-h-11 items-center text-primary hover:underline xl:min-h-0"
                  >
                    {row.memberName}
                  </Link>
                </td>
                <td className={cell}>
                  <PhoneLabel>Occurrence</PhoneLabel>
                  {row.occurrenceCount}
                </td>
                <td className={cell}>
                  <PhoneLabel>Hadir</PhoneLabel>
                  {row.hadir}
                </td>
                <td className={cell}>
                  <PhoneLabel>Izin</PhoneLabel>
                  {row.izin}
                </td>
                <td className={cell}>
                  <PhoneLabel>% Hadir</PhoneLabel>
                  {row.percentHadir}%
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr className="block md:table-row">
                <td colSpan={COLUMNS.length} className="block py-4 text-center text-muted-foreground md:table-cell">
                  Tidak ada anggota dalam scope ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...visible} onPageChange={setPage} />
    </div>
  );
}

function PhoneLabel({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 text-xs text-muted-foreground md:hidden">{children}</span>;
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pagination } from "@/components/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { paginate } from "@/lib/pagination";
import type { ParticipationRow } from "@/lib/stats";

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

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              {COLUMNS.map((col) => (
                <th key={col.key} className={col.align === "right" ? "py-2 text-right" : "py-2 text-left"}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="hover:text-foreground"
                  >
                    {col.label}
                    {sortKey === col.key && (descending ? " ↓" : " ↑")}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.items.map((row) => (
              <tr key={row.memberId} className="border-b last:border-0">
                <td className="py-2">
                  <Link href={`/anggota/${row.memberId}`} className="text-primary hover:underline">
                    {row.memberName}
                  </Link>
                </td>
                <td className="py-2 text-right">{row.occurrenceCount}</td>
                <td className="py-2 text-right">{row.hadir}</td>
                <td className="py-2 text-right">{row.izin}</td>
                <td className="py-2 text-right">{row.percentHadir}%</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="py-4 text-center text-muted-foreground">
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

import Link from "next/link";
import { SortIcon } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { SortSelect } from "@/components/sort-select";
import { type Paginated, pageHref } from "@/lib/pagination";
import {
  DEFAULT_OCCURRENCE_SORT,
  OCCURRENCE_SORT_PARAMS,
  type OccurrenceSortKey,
  type SortDir,
  type SortState,
  sortHref,
} from "@/lib/sort";
import type { ActivityOccurrenceAttendance } from "@/lib/stats";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

const COLUMNS: { key: OccurrenceSortKey; label: string; firstDir: SortDir }[] = [
  { key: "tanggal", label: "Tanggal", firstDir: "desc" },
  { key: "hadir", label: "Hadir", firstDir: "desc" },
  { key: "izin", label: "Izin", firstDir: "desc" },
  { key: "tidakHadir", label: "Tidak hadir", firstDir: "desc" },
  { key: "expected", label: "Expected", firstDir: "desc" },
  { key: "persen", label: "% Hadir", firstDir: "desc" },
];

// Below md the table markup is laid out as one card per occurrence: date and action on the first line, then the numbers two per row.
const statCell = "flex items-center justify-between gap-3 text-sm md:table-cell md:py-2 md:pr-2 md:text-right";

function PhoneLabel({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 text-xs text-muted-foreground md:hidden">{children}</span>;
}

/**
 * "Per occurrence" on the activity Absensi tab: one page, sorted and sliced on the server. Headers and the pager
 * are links under this table's own params (`ksort`/`kdir`/`kejadian`), so the member table beside it keeps its state.
 */
export function OccurrenceTable({
  page,
  sort,
  activityId,
  canRecord,
  basePath,
  searchParams,
}: {
  page: Paginated<ActivityOccurrenceAttendance>;
  sort: SortState<OccurrenceSortKey>;
  activityId: number;
  canRecord: boolean;
  basePath: string;
  searchParams: SearchParams;
}) {
  const fallback = DEFAULT_OCCURRENCE_SORT;
  const names = OCCURRENCE_SORT_PARAMS;

  const selectOptions = COLUMNS.flatMap((col) =>
    (["asc", "desc"] as const).map((dir) => ({
      value: `${col.key}:${dir}`,
      label: `${col.label} (${dir === "asc" ? "naik" : "turun"})`,
      // `current` is the opposite direction of the target, so the link flips to exactly `dir`.
      href: sortHref(basePath, searchParams, col.key, { key: col.key, dir: dir === "asc" ? "desc" : "asc" }, fallback, "asc", names),
    })),
  );

  return (
    <div className="flex flex-col gap-3">
      <SortSelect options={selectOptions} value={`${sort.key}:${sort.dir}`} label="Urutkan kejadian" />
      <div className="relative overflow-x-auto">
        <table className="block w-full text-sm md:table">
          <thead className="hidden md:table-header-group">
            <tr className="border-b text-left text-xs whitespace-nowrap text-muted-foreground">
              {COLUMNS.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
                    className={cn("py-2 pr-2", col.key !== "tanggal" && "text-right")}
                  >
                    <Link
                      href={sortHref(basePath, searchParams, col.key, sort, fallback, col.firstDir, names)}
                      scroll={false}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1 hover:text-foreground xl:min-h-0",
                        active && "text-foreground",
                      )}
                    >
                      {col.label}
                      <SortIcon dir={active ? sort.dir : undefined} />
                    </Link>
                  </th>
                );
              })}
              <th scope="col" className="py-2 pl-2 text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {page.items.map((o) => (
              <tr
                key={o.key}
                className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b py-3 last:border-0 md:table-row md:p-0"
              >
                <td className="block font-medium md:table-cell md:py-2 md:pr-2 md:font-normal md:whitespace-nowrap">
                  {o.effectiveDate}
                </td>
                <td className={cn(statCell, "col-span-1")}>
                  <PhoneLabel>Hadir</PhoneLabel>
                  {o.hadir}
                </td>
                <td className={statCell}>
                  <PhoneLabel>Izin</PhoneLabel>
                  {o.izin}
                </td>
                <td className={statCell}>
                  <PhoneLabel>Tidak hadir</PhoneLabel>
                  {o.absent}
                </td>
                <td className={statCell}>
                  <PhoneLabel>Expected</PhoneLabel>
                  {o.expected}
                </td>
                <td className={statCell}>
                  <PhoneLabel>% Hadir</PhoneLabel>
                  {o.percentHadir}%
                </td>
                <td className="col-start-2 row-start-1 text-right md:table-cell md:py-2 md:pl-2">
                  <Link
                    href={`/dashboard/kegiatan/${activityId}/${o.key}`}
                    className="inline-flex min-h-11 items-center text-base text-primary hover:underline xl:min-h-0 xl:text-xs"
                  >
                    {canRecord ? (o.hadir + o.izin > 0 ? "Ubah absensi" : "Isi absensi") : "Lihat"}
                  </Link>
                </td>
              </tr>
            ))}
            {page.total === 0 && (
              <tr className="block md:table-row">
                <td colSpan={COLUMNS.length + 1} className="block py-4 text-center text-muted-foreground md:table-cell">
                  Belum ada riwayat absensi pada rentang ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...page} hrefFor={(target) => pageHref(basePath, searchParams, target, names.page)} scroll={false} />
    </div>
  );
}

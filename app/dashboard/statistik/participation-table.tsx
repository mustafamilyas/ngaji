import Link from "next/link";
import { SortIcon } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { SortSelect } from "@/components/sort-select";
import { type Paginated, pageHref } from "@/lib/pagination";
import {
  DEFAULT_PARTICIPATION_SORT,
  DEFAULT_SORT_PARAMS,
  type ParticipationSortKey,
  type SortDir,
  type SortParams,
  type SortState,
  sortHref,
} from "@/lib/sort";
import type { ParticipationRow } from "@/lib/stats";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

const COLUMNS: { key: ParticipationSortKey; label: string; align?: "right"; firstDir: SortDir }[] = [
  { key: "nama", label: "Nama", firstDir: "asc" },
  { key: "occurrence", label: "Occurrence", align: "right", firstDir: "desc" },
  { key: "hadir", label: "Hadir", align: "right", firstDir: "desc" },
  { key: "izin", label: "Izin", align: "right", firstDir: "desc" },
  { key: "persen", label: "% Hadir", align: "right", firstDir: "desc" },
];

/**
 * Participation table of one page. The server searched, sorted and sliced (`participationPage`); headers and the
 * pager are plain links, so the order and page live in the URL and nothing but this page's rows is sent.
 */
export function ParticipationTable({
  page,
  sort,
  basePath,
  searchParams,
  params = DEFAULT_SORT_PARAMS,
  selectLabel,
}: {
  page: Paginated<ParticipationRow>;
  sort: SortState<ParticipationSortKey>;
  basePath: string;
  searchParams: SearchParams;
  /** Query param names of this table's order and page; a page with a second table gives each its own. */
  params?: SortParams;
  selectLabel?: string;
}) {
  const fallback = DEFAULT_PARTICIPATION_SORT;
  const cell = "flex items-center justify-between gap-3 text-sm md:table-cell md:py-2 md:text-right";

  const selectOptions = COLUMNS.flatMap((col) =>
    (["asc", "desc"] as const).map((dir) => ({
      value: `${col.key}:${dir}`,
      label: `${col.label} (${dir === "asc" ? "naik" : "turun"})`,
      // `current` is the opposite direction of the target, so the link flips to exactly `dir`.
      href: sortHref(basePath, searchParams, col.key, { key: col.key, dir: dir === "asc" ? "desc" : "asc" }, fallback, "asc", params),
    })),
  );

  return (
    <div className="flex flex-col gap-3">
      <SortSelect options={selectOptions} value={`${sort.key}:${sort.dir}`} label={selectLabel} />
      <div className="relative overflow-x-auto">
        <table className="block w-full text-sm md:table">
          <thead className="hidden md:table-header-group">
            <tr className="border-b text-xs text-muted-foreground">
              {COLUMNS.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
                    className={col.align === "right" ? "py-2 text-right" : "py-2 text-left"}
                  >
                    <Link
                      href={sortHref(basePath, searchParams, col.key, sort, fallback, col.firstDir, params)}
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
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {page.items.map((row) => (
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
            {page.total === 0 && (
              <tr className="block md:table-row">
                <td colSpan={COLUMNS.length} className="block py-4 text-center text-muted-foreground md:table-cell">
                  Tidak ada anggota dalam scope ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...page} hrefFor={(target) => pageHref(basePath, searchParams, target, params.page)} scroll={false} />
    </div>
  );
}

function PhoneLabel({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 text-xs text-muted-foreground md:hidden">{children}</span>;
}

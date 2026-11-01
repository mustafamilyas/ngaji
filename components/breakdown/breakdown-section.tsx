import { Pagination } from "@/components/pagination";
import { EMBEDDED_PAGE_SIZE } from "@/lib/constants";
import { pageHref, paginate } from "@/lib/pagination";
import type { AttendanceBreakdown } from "@/lib/summary/breakdown";
import type { TagChoiceGroup } from "@/lib/tag/choices";
import { BreakdownPicker } from "./breakdown-picker";
import { FIXED_BREAKDOWN_OPTIONS } from "./options";

/** Query param holding the page of the breakdown table. */
export const BREAKDOWN_PAGE_PARAM = "rincianhal";

type SearchParams = Record<string, string | string[] | undefined>;

function formatPercent(percent: number): string {
  return `${percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

/** The query params that stay when the choice changes: everything except the choice and its page. */
function carriedQuery(searchParams: SearchParams): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first === undefined || key === "rincian" || key === BREAKDOWN_PAGE_PARAM) continue;
    query[key] = first;
  }
  return query;
}

/**
 * "Rincian menurut": the picker plus, for the chosen dimension, a table of expected / hadir / izin / tidak hadir
 * / % hadir per bucket (member-summaries, attendance-breakdown). The server decided `selected` and `breakdown`
 * (an unusable choice arrives as none); this component only renders, paging the rows with its own param.
 */
export function BreakdownSection({
  choices,
  breakdown,
  selected,
  basePath,
  searchParams,
  page,
}: {
  choices: TagChoiceGroup[];
  breakdown: AttendanceBreakdown | null;
  /** The validated `?rincian=` value, or undefined for none. */
  selected: string | undefined;
  basePath: string;
  searchParams: SearchParams;
  page: number;
}) {
  const fixedLabel = FIXED_BREAKDOWN_OPTIONS.find((o) => o.value === selected)?.label;
  const selectedLabel = breakdown ? (fixedLabel ?? breakdown.label) : undefined;
  const shown = breakdown ? paginate(breakdown.rows, page, EMBEDDED_PAGE_SIZE) : null;

  return (
    <section aria-labelledby="rincian-heading" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="rincian-heading" className="text-sm font-medium">Rincian kehadiran</h3>
        <BreakdownPicker
          choices={choices}
          selected={breakdown ? selected : undefined}
          selectedLabel={selectedLabel}
          basePath={basePath}
          query={carriedQuery(searchParams)}
        />
      </div>

      {breakdown && shown && (
        <>
          <p className="text-xs text-muted-foreground">Berdasarkan data anggota saat ini.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-base xl:text-sm">
              <caption className="sr-only">Kehadiran menurut {breakdown.label}</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">{breakdown.label}</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Expected</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Hadir</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Izin</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Tidak hadir</th>
                  <th scope="col" className="py-2 pl-2 text-right font-medium">% hadir</th>
                </tr>
              </thead>
              <tbody>
                {shown.items.map((row) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <th scope="row" className="min-w-32 py-2 pr-3 text-left font-normal break-words">{row.label}</th>
                    <td className="px-2 py-2 text-right tabular-nums">{row.expected}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.hadir}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.izin}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.absent}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">{formatPercent(row.percentHadir)}</td>
                  </tr>
                ))}
                {shown.total === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-muted-foreground">
                      Tidak ada anggota yang diharapkan pada rentang ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={shown.page}
            pageSize={shown.pageSize}
            total={shown.total}
            hrefFor={(target) => pageHref(basePath, searchParams, target, BREAKDOWN_PAGE_PARAM)}
            scroll={false}
          />
        </>
      )}
    </section>
  );
}

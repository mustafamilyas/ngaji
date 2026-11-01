import { Pagination } from "@/components/pagination";
import { pageHref } from "@/lib/pagination";
import type { SummaryCard } from "@/lib/member-view/summaries";
import { SummaryChart } from "./summary-chart";

/** Query param holding the table page of the card at `index`. */
export const summaryPageParam = (index: number) => `ringkasan${index}`;

function formatPercent(percent: number): string {
  return `${percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function Card({
  card,
  basePath,
  searchParams,
}: {
  card: SummaryCard;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const rows = card.table?.items ?? card.chart;
  const param = summaryPageParam(card.index);

  return (
    <section aria-labelledby={`ringkasan-${card.index}`} className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <h3 id={`ringkasan-${card.index}`} className="text-sm font-medium break-words">
          {card.title || "Ringkasan"}
        </h3>
        <p className="text-xs text-muted-foreground">{card.total} anggota</p>
      </div>

      {card.levelInvalid ? (
        <p className="text-sm text-muted-foreground">Tingkat grup ini tidak berlaku untuk akun Anda.</p>
      ) : card.bucketCount === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada data.</p>
      ) : (
        <>
          <SummaryChart buckets={card.chart} />
          <div className="overflow-x-auto">
            <table className="w-full text-base xl:text-sm">
              <caption className="sr-only">Jumlah anggota per {card.title}</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Kategori</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Jumlah</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">Persen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((bucket) => (
                  <tr key={bucket.key} className="border-b last:border-0">
                    <th scope="row" className="min-w-32 py-2 pr-3 text-left font-normal break-words">{bucket.label}</th>
                    <td className="px-3 py-2 text-right tabular-nums">{bucket.count}</td>
                    <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">{formatPercent(bucket.percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {card.table && (
            <Pagination
              page={card.table.page}
              pageSize={card.table.pageSize}
              total={card.table.total}
              hrefFor={(target) => pageHref(basePath, searchParams, target, param)}
              scroll={false}
            />
          )}
        </>
      )}
    </section>
  );
}

/** "Ringkasan" above the results: one card per summary, in saved order. */
export function SummaryCards({
  cards,
  basePath,
  searchParams,
}: {
  cards: SummaryCard[];
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (cards.length === 0) return null;
  return (
    <section aria-label="Ringkasan" className="grid items-start gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <Card key={card.index} card={card} basePath={basePath} searchParams={searchParams} />
      ))}
    </section>
  );
}

import Link from "next/link";
import { Pencil } from "lucide-react";
import { TableCard, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { FilterBar, SearchFilter } from "@/components/filters/filter-bar";
import { GroupFilter, type FilterGroup } from "@/components/filters/group-filter";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { dateOf } from "@/lib/dates";
import { formatDate } from "@/lib/filters";
import { pageHref } from "@/lib/pagination";
import type { listRespondents } from "@/lib/survey/respondents";

import { cn } from "@/lib/utils";
import { DeleteResponseButton } from "./delete-response-button";

// Below md the same table markup is laid out as one card per respondent (no sideways scrolling); header cells are table-only.
const stackedCell =
  "col-span-2 flex items-center justify-between gap-3 px-0 py-0 text-sm whitespace-normal md:table-cell md:px-4 md:py-2.5 md:whitespace-nowrap";

function PhoneLabel({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 text-xs text-muted-foreground md:hidden">{children}</span>;
}

function formatTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(instant);
}

/** "Responden" tab: who answered, who saved it last, with edit/delete for users allowed to record. */
export function RespondentsTab({
  surveyId,
  list,
  groups,
  params,
  search,
  groupIds,
  timeZone,
}: {
  surveyId: number;
  list: Awaited<ReturnType<typeof listRespondents>>;
  groups: FilterGroup[];
  params: Record<string, string | string[] | undefined>;
  search?: string;
  groupIds?: number[];
  /** Organization timezone the "updated at" stamps are shown in. */
  timeZone: string;
}) {
  const path = `/dashboard/survei/${surveyId}`;
  const isFiltered = Boolean(search || groupIds);
  const { respondents, canRecord } = list;

  return (
    <TableCard
      title={
        <span>
          <span className="font-medium text-foreground">{list.total}</span> responden
        </span>
      }
      toolbar={
        <FilterBar action={path} preserve={{ tab: "responden" }} isFiltered={isFiltered} resetHref={`${path}?tab=responden`}>
          <SearchFilter value={search} placeholder="Cari nama anggota…" />
          <GroupFilter
            groups={groups}
            selected={groupIds ?? []}
            withDescendantsAction
            hint="Menampilkan responden dari grup terpilih, termasuk turunannya."
          />
        </FilterBar>
      }
      footer={
        list.total > list.pageSize ? (
          <Pagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefFor={(target) => pageHref(path, params, target)}
          />
        ) : undefined
      }
    >
      {respondents.length > 0 ? (
        <div className="relative overflow-x-auto">
          <table className={cn(tableClass, "block md:table")}>
            <thead className="hidden md:table-header-group">
              <tr className={theadRowClass}>
                <th scope="col" className={thClass}>Nama</th>
                <th scope="col" className={thClass}>Grup</th>
                <th scope="col" className={thClass}>Disimpan oleh</th>
                <th scope="col" className={thClass}>Waktu</th>
                {canRecord && (
                  <th scope="col" className={cn(thClass, "w-24")}>
                    <span className="sr-only">Aksi</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {respondents.map((r) => (
                <tr
                  key={r.memberId}
                  className={cn(trClass, "grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 px-4 py-2 md:table-row md:p-0")}
                >
                  <td className={cn(tdClass, "block min-w-0 p-0 whitespace-normal md:table-cell md:px-4 md:py-2.5 md:whitespace-nowrap")}>
                    <span className="font-medium">{r.name}</span>
                    {r.memberStatus !== "AKTIF" && (
                      <Badge variant="secondary" className="ml-2">
                        Tidak aktif
                      </Badge>
                    )}
                  </td>
                  <td className={stackedCell}>
                    <PhoneLabel>Grup</PhoneLabel>
                    <span>{r.groupName}</span>
                  </td>
                  <td className={stackedCell}>
                    <PhoneLabel>Disimpan oleh</PhoneLabel>
                    <span>{r.recordedByName}</span>
                  </td>
                  <td className={cn(stackedCell, "tabular-nums text-muted-foreground")}>
                    <PhoneLabel>Waktu</PhoneLabel>
                    <span>
                      {formatDate(dateOf(r.updatedAt, timeZone))} {formatTime(r.updatedAt, timeZone)}
                    </span>
                  </td>
                  {canRecord && (
                    <td className="col-start-2 row-start-1 flex p-0 text-right whitespace-nowrap md:table-cell md:px-2 md:py-1">
                      {r.memberStatus === "AKTIF" && (
                        <Link
                          href={`${path}/isi?anggota=${r.memberId}`}
                          aria-label={`Ubah respons ${r.name}`}
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                        >
                          <Pencil />
                        </Link>
                      )}
                      <DeleteResponseButton surveyId={surveyId} memberId={r.memberId} memberName={r.name} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {isFiltered ? "Tidak ada responden yang cocok." : "Belum ada responden."}
        </p>
      )}
    </TableCard>
  );
}

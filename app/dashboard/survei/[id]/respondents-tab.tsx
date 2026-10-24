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
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** "Responden" tab: who answered, who saved it last, with edit/delete for users allowed to record. */
export function RespondentsTab({
  surveyId,
  list,
  groups,
  params,
  search,
  groupIds,
}: {
  surveyId: number;
  list: Awaited<ReturnType<typeof listRespondents>>;
  groups: FilterGroup[];
  params: Record<string, string | string[] | undefined>;
  search?: string;
  groupIds?: number[];
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
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
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
            <tbody>
              {respondents.map((r) => (
                <tr key={r.memberId} className={trClass}>
                  <td className={tdClass}>
                    <span className="font-medium">{r.name}</span>
                    {r.memberStatus !== "AKTIF" && (
                      <Badge variant="secondary" className="ml-2">
                        Tidak aktif
                      </Badge>
                    )}
                  </td>
                  <td className={tdClass}>{r.groupName}</td>
                  <td className={tdClass}>{r.recordedByName}</td>
                  <td className={cn(tdClass, "tabular-nums text-muted-foreground")}>
                    {formatDate(dateOf(r.updatedAt, DEFAULT_TIMEZONE))} {timeFormat.format(r.updatedAt)}
                  </td>
                  {canRecord && (
                    <td className="px-2 py-1 text-right whitespace-nowrap">
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

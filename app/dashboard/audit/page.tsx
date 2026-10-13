import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SortableTh, TableCard, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar, SelectFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { visibleGroupsWhere } from "@/lib/authz";
import { AUDIT_ACTIONS, AUDIT_DATE_RANGE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, resolveDateRange } from "@/lib/filters";
import { AUDIT_SORT_KEYS, type AuditSortKey, DEFAULT_AUDIT_SORT, listAuditLog } from "@/lib/audit-log/queries";
import { pageHref } from "@/lib/pagination";
import { parseSort, sortHref, sortPreserve } from "@/lib/sort";
import { listUsersInScope } from "@/lib/user/queries";
import { cn } from "@/lib/utils";
import { AuditDetailDialog } from "./audit-detail-dialog";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const action =
    typeof params.action === "string" && (AUDIT_ACTIONS as readonly string[]).includes(params.action)
      ? params.action
      : undefined;
  const actorParam = typeof params.aktor === "string" ? Number(params.aktor) : NaN;
  const actorId = Number.isInteger(actorParam) && actorParam > 0 ? actorParam : undefined;
  const now = today();
  const dateRange = resolveDateRange(params, AUDIT_DATE_RANGE, now);
  const { from, to } = dateRange;
  const groupIds = parseGroupIds(params.grup);
  const page = parsePage(params.page);
  const sort = parseSort(params, AUDIT_SORT_KEYS, DEFAULT_AUDIT_SORT);

  let result: Awaited<ReturnType<typeof listAuditLog>>;
  let actors: Awaited<ReturnType<typeof listUsersInScope>>;
  let groups: { id: number; parentId: number | null; name: string; path: string }[];
  try {
    [result, actors, groups] = await Promise.all([
      listAuditLog(session.user, { action, actorId, from, to, groupIds, page, sort }),
      listUsersInScope(session.user),
      db.group.findMany({
        where: visibleGroupsWhere(session.user),
        orderBy: [{ depth: "asc" }, { name: "asc" }],
        select: { id: true, parentId: true, name: true, path: true },
      }),
    ]);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const { entries, total, page: currentPage, pageSize } = result;
  const isFiltered = Boolean(action || actorId || groupIds || dateRange.mode !== AUDIT_DATE_RANGE.defaultMode);
  const th = (key: AuditSortKey, label: string) => (
    <SortableTh
      label={label}
      href={sortHref("/dashboard/audit", params, key, sort, DEFAULT_AUDIT_SORT, key === "waktu" ? "desc" : "asc")}
      dir={sort.key === key ? sort.dir : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit Log" meta="Setiap perubahan data dan aktivitas masuk dalam scope Anda." />

      <TableCard
        title={
          <>
            {isFiltered ? "Hasil filter" : "Semua entri"}: <span className="font-medium text-foreground">{total} entri</span>
          </>
        }
        toolbar={
          <FilterBar
            action="/dashboard/audit"
            preserve={sortPreserve(sort, DEFAULT_AUDIT_SORT)}
            isFiltered={isFiltered}
            resetHref="/dashboard/audit"
          >
            <GroupFilter
              groups={groups}
              selected={groupIds ?? []}
              hint="Termasuk semua grup di bawahnya. Entri login/logout tanpa grup tidak ikut."
            />
            <DateRangeFilter range={dateRange} {...AUDIT_DATE_RANGE} today={now} />
            <SelectFilter
              name="action"
              value={action}
              label="Aksi"
              allLabel="Semua aksi"
              options={AUDIT_ACTIONS.map((value) => ({ value, label: value }))}
            />
            <SelectFilter
              name="aktor"
              value={actorId ? String(actorId) : undefined}
              label="Aktor"
              allLabel="Semua aktor"
              options={actors.map((role) => ({ value: String(role.user.id), label: role.user.name }))}
            />
          </FilterBar>
        }
        footer={
          total > pageSize ? (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={total}
              hrefFor={(target) => pageHref("/dashboard/audit", params, target)}
            />
          ) : undefined
        }
      >
        {entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={theadRowClass}>
                  {th("waktu", "Waktu")}
                  {th("aksi", "Aksi")}
                  {th("aktor", "Aktor")}
                  {th("entitas", "Entitas")}
                  <th scope="col" className={cn(thClass, "w-12")}>
                    <span className="sr-only">Detail</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const when = formatDateTime(entry.createdAt);
                  const hasDetail = entry.before !== null || entry.after !== null || entry.meta !== null;
                  return (
                    <tr key={entry.id} className={trClass}>
                      <td className={cn(tdClass, "text-muted-foreground tabular-nums")}>{when}</td>
                      <td className={tdClass}>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{entry.action}</code>
                      </td>
                      <td className={tdClass}>{entry.actor?.name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className={cn(tdClass, "text-muted-foreground")}>
                        {entry.entity ? `${entry.entity}${entry.entityId ? ` #${entry.entityId}` : ""}` : "—"}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {hasDetail && (
                          <AuditDetailDialog
                            title={entry.action}
                            subtitle={`${when} · ${entry.actor?.name ?? "—"}`}
                            detail={JSON.stringify({ before: entry.before, after: entry.after, meta: entry.meta }, null, 2)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada entri yang cocok.</p>
        )}
      </TableCard>
    </div>
  );
}

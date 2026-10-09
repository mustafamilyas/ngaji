import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar, SelectFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { visibleGroupsWhere } from "@/lib/authz";
import { AUDIT_ACTIONS, AUDIT_DATE_RANGE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, resolveDateRange } from "@/lib/filters";
import { listAuditLog } from "@/lib/audit-log/queries";
import { listUsersInScope } from "@/lib/user/queries";

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

  let result: Awaited<ReturnType<typeof listAuditLog>>;
  let actors: Awaited<ReturnType<typeof listUsersInScope>>;
  let groups: { id: number; parentId: number | null; name: string; path: string }[];
  try {
    [result, actors, groups] = await Promise.all([
      listAuditLog(session.user, { action, actorId, from, to, groupIds, page }),
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (action) next.set("action", action);
    if (actorId) next.set("aktor", String(actorId));
    if (groupIds) next.set("grup", groupIds.join(","));
    next.set("range", dateRange.mode);
    if (dateRange.mode === "custom") {
      if (from) next.set("from", from);
      if (to) next.set("to", to);
    } else if (dateRange.anchor !== now) {
      next.set("anchor", dateRange.anchor);
    }
    next.set("page", String(target));
    return `/audit?${next.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Audit Log</h1>

      <FilterBar
        action="/audit"
        isFiltered={Boolean(action || actorId || groupIds || dateRange.mode !== AUDIT_DATE_RANGE.defaultMode)}
        resetHref="/audit"
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

      <p className="text-sm text-muted-foreground">{total} entri</p>

      {entries.length > 0 ? (
        <ul className="flex flex-col divide-y text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{entry.action}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {entry.actor?.name ?? "—"}
                {entry.entity ? ` · ${entry.entity}${entry.entityId ? ` #${entry.entityId}` : ""}` : ""}
              </p>
              {(entry.before !== null || entry.after !== null || entry.meta !== null) && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Detail</summary>
                  <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2">
                    {JSON.stringify({ before: entry.before, after: entry.after, meta: entry.meta }, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Tidak ada entri yang cocok.</p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {currentPage > 1 ? (
            <Link href={pageHref(currentPage - 1)} className="text-primary hover:underline">
              Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Halaman {currentPage} dari {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link href={pageHref(currentPage + 1)} className="text-primary hover:underline">
              Berikutnya
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { NotFoundError } from "@/lib/errors";
import { listAuditLog } from "@/lib/audit-log/queries";
import { listUsersInScope } from "@/lib/user/queries";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
  const action = typeof params.action === "string" ? params.action : undefined;
  const actorId = typeof params.aktor === "string" ? Number(params.aktor) : undefined;
  const from = typeof params.from === "string" ? params.from : undefined;
  const to = typeof params.to === "string" ? params.to : undefined;
  const page = typeof params.page === "string" ? Number(params.page) : undefined;

  let result: Awaited<ReturnType<typeof listAuditLog>>;
  let actors: Awaited<ReturnType<typeof listUsersInScope>>;
  try {
    [result, actors] = await Promise.all([
      listAuditLog(session.user, { action, actorId, from, to, page }),
      listUsersInScope(session.user),
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
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    next.set("page", String(target));
    return `/audit?${next.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Audit Log</h1>

      <form className="flex flex-wrap gap-2" method="get">
        <select name="action" defaultValue={action ?? ""} className={inputClass}>
          <option value="">Semua aksi</option>
          {AUDIT_ACTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select name="aktor" defaultValue={actorId ?? ""} className={inputClass}>
          <option value="">Semua aktor</option>
          {actors.map((role) => (
            <option key={role.user.id} value={role.user.id}>
              {role.user.name}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from} className={inputClass} />
        <input type="date" name="to" defaultValue={to} className={inputClass} />
        <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted">
          Filter
        </button>
      </form>

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

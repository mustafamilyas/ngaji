import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { listActivityOccurrences } from "@/lib/activity/list";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { addDays, sundayOf, today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function ActivityListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const defaultFrom = sundayOf(today());
  const defaultTo = addDays(defaultFrom, 6);
  const from = typeof params.from === "string" ? params.from : defaultFrom;
  const to = typeof params.to === "string" ? params.to : defaultTo;
  const grup = typeof params.grup === "string" ? Number(params.grup) : undefined;

  const [{ entries, group }, groups] = await Promise.all([
    (async () => {
      try {
        return await listActivityOccurrences(session.user, { from, to, groupId: grup });
      } catch (error) {
        if (error instanceof NotFoundError) notFound();
        throw error;
      }
    })(),
    db.group.findMany({
      where: visibleGroupsWhere(session.user),
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  function rangeHref(newFrom: string, newTo: string) {
    const next = new URLSearchParams();
    next.set("from", newFrom);
    next.set("to", newTo);
    if (grup) next.set("grup", String(grup));
    return `/kegiatan?${next.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Kegiatan</h1>
        <Link href="/kegiatan/baru" className="text-sm text-primary hover:underline">
          Kegiatan baru
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs text-muted-foreground">
            Dari
          </label>
          <input id="from" type="date" name="from" defaultValue={from} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs text-muted-foreground">
            Sampai
          </label>
          <input id="to" type="date" name="to" defaultValue={to} className={inputClass} />
        </div>
        <select name="grup" defaultValue={grup ?? ""} className={inputClass}>
          <option value="">Grup saya</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted">
          Tampilkan
        </button>
      </form>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <Link href={rangeHref(addDays(from, -7), addDays(to, -7))} className="text-primary hover:underline">
          Minggu sebelumnya
        </Link>
        <span>{group.name}</span>
        <Link href={rangeHref(addDays(from, 7), addDays(to, 7))} className="text-primary hover:underline">
          Minggu berikutnya
        </Link>
      </div>

      {entries.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {entries.map((entry) => (
            <li key={`${entry.activityId}:${entry.key}`} className="flex flex-col gap-1 py-3">
              <Link
                href={`/kegiatan/${entry.activityId}`}
                className="flex items-center justify-between gap-2 text-sm font-medium"
              >
                <span>{entry.activityName}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.effectiveDate} · {entry.effectiveStartTime}
                </span>
              </Link>
              <p className="text-xs text-muted-foreground">
                {entry.groupName} · {entry.effectiveLocation}
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.inherited && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">warisan</span>
                )}
                {entry.moved && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">dipindah</span>}
                {entry.status === "CANCELLED" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">batal</span>
                )}
                {entry.hasConflict && (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                    konflik
                  </span>
                )}
                {entry.canRecord && (
                  <Link
                    href={`/kegiatan/${entry.activityId}/${entry.key}`}
                    className="ml-auto text-xs text-primary hover:underline"
                  >
                    Isi absensi
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Tidak ada kegiatan pada rentang ini.</p>
      )}
    </div>
  );
}

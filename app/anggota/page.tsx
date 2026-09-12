import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { formatEnumLabel, MEMBER_STATUS_LABELS } from "@/lib/member/labels";
import { listMembers } from "@/lib/member/queries";
import { MEMBER_STATUSES, type MemberStatus } from "@/lib/validation/enums";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function isMemberStatus(value: string): value is MemberStatus {
  return (MEMBER_STATUSES as readonly string[]).includes(value);
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const grup = typeof params.grup === "string" ? Number(params.grup) : undefined;
  const status = typeof params.status === "string" && isMemberStatus(params.status) ? params.status : undefined;
  const page = typeof params.page === "string" ? Number(params.page) : undefined;

  const [{ members, total, pageSize }, groups] = await Promise.all([
    (async () => {
      try {
        return await listMembers(session.user, { search: q, groupId: grup, status, page });
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

  const currentPage = page && page > 0 ? Math.floor(page) : 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (grup) next.set("grup", String(grup));
    if (status) next.set("status", status);
    next.set("page", String(target));
    return `/anggota?${next.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Anggota</h1>
        <Link href="/anggota/baru" className="text-sm text-primary hover:underline">
          Tambah anggota
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input type="search" name="q" placeholder="Cari nama" defaultValue={q} className={`${inputClass} flex-1`} />
        <select name="grup" defaultValue={grup ?? ""} className={inputClass}>
          <option value="">Semua grup</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} className={inputClass}>
          <option value="">Semua status</option>
          {MEMBER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted">
          Cari
        </button>
      </form>

      <p className="text-sm text-muted-foreground">{total} anggota</p>

      {members.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {members.map((member) => (
            <li key={member.id} className="py-2">
              <Link href={`/anggota/${member.id}`} className="flex items-center justify-between gap-2">
                <span className="text-sm">{member.name}</span>
                <span className="text-xs text-muted-foreground">
                  {member.group.name} · {MEMBER_STATUS_LABELS[member.status as MemberStatus]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Tidak ada anggota yang cocok.</p>
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

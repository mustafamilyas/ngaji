import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, parseSearch } from "@/lib/filters";
import { MEMBER_STATUS_LABELS } from "@/lib/member/labels";
import { listMembers } from "@/lib/member/queries";
import { MEMBER_STATUSES, type MemberStatus } from "@/lib/validation/enums";

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
  const q = parseSearch(params.q);
  const groupIds = parseGroupIds(params.grup);
  const status = typeof params.status === "string" && isMemberStatus(params.status) ? params.status : undefined;
  const page = parsePage(params.page);

  const [{ members, total, pageSize }, groups] = await Promise.all([
    (async () => {
      try {
        return await listMembers(session.user, { search: q, groupIds, status, page });
      } catch (error) {
        if (error instanceof NotFoundError) notFound();
        throw error;
      }
    })(),
    db.group.findMany({
      where: visibleGroupsWhere(session.user),
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, path: true },
    }),
  ]);

  const currentPage = page;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (groupIds) next.set("grup", groupIds.join(","));
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

      <FilterBar action="/anggota" isFiltered={Boolean(q || groupIds || status)} resetHref="/anggota">
        <SearchFilter value={q} placeholder="Cari nama anggota…" />
        <GroupFilter groups={groups} selected={groupIds ?? []} hint="Termasuk semua grup di bawahnya." />
        <SelectFilter
          name="status"
          value={status}
          label="Status"
          allLabel="Semua status"
          options={MEMBER_STATUSES.map((value) => ({ value, label: MEMBER_STATUS_LABELS[value] }))}
        />
      </FilterBar>

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

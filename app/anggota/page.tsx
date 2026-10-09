import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ColumnToggle } from "@/components/column-toggle";
import { Pagination } from "@/components/pagination";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, parseSearch } from "@/lib/filters";
import { MEMBER_COLUMNS, MEMBER_COLUMNS_COOKIE, parseMemberColumns } from "@/lib/member/columns";
import { MEMBER_STATUS_LABELS } from "@/lib/member/labels";
import { pageHref } from "@/lib/pagination";
import { listMembers } from "@/lib/member/queries";
import { MEMBER_STATUSES, type MemberStatus } from "@/lib/validation/enums";
import { setMemberColumnsAction } from "./actions";
import { MembersTable } from "./members-table";

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
  const columns = parseMemberColumns((await cookies()).get(MEMBER_COLUMNS_COOKIE)?.value);

  const [{ members, total, page: currentPage, pageSize }, groups] = await Promise.all([
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

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{total} anggota</p>
        <ColumnToggle columns={MEMBER_COLUMNS} visible={columns} action={setMemberColumnsAction} />
      </div>

      {members.length > 0 ? (
        <MembersTable members={members} columns={columns} />
      ) : (
        <p className="text-sm text-muted-foreground">Tidak ada anggota yang cocok.</p>
      )}

      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={total}
        hrefFor={(target) => pageHref("/anggota", params, target)}
      />
    </div>
  );
}

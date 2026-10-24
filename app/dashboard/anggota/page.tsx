import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { UserCheck, UserPlus, Users, UsersRound } from "lucide-react";
import { auth } from "@/auth";
import { ColumnToggle } from "@/components/column-toggle";
import { StatTile, StatTiles, TableCard } from "@/components/data-table";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { monthStartOf, today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, parseSearch } from "@/lib/filters";
import { MEMBER_COLUMNS_COOKIE, MEMBER_COLUMNS, parseMemberColumns } from "@/lib/member/columns";
import { MEMBER_STATUS_LABELS } from "@/lib/member/labels";
import { DEFAULT_MEMBER_SORT, listMembers, MEMBER_SORT_KEYS } from "@/lib/member/queries";
import { pageHref } from "@/lib/pagination";
import { parseSort, sortHref, sortPreserve } from "@/lib/sort";
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
  // Only the name and visible columns can be sorted on: ordering by a hidden column would leak its values.
  const sortable = MEMBER_SORT_KEYS.filter((key) => key === "nama" || (columns as string[]).includes(key));
  const sort = parseSort(params, sortable, DEFAULT_MEMBER_SORT);

  const scope = { group: { path: { startsWith: session.user.groupPath } } };
  const [{ members, total, page: currentPage, pageSize }, groups, scopeTotal, activeTotal, joinedThisMonth] =
    await Promise.all([
      (async () => {
        try {
          return await listMembers(session.user, { search: q, groupIds, status, page, sort });
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
      db.member.count({ where: scope }),
      db.member.count({ where: { ...scope, status: "AKTIF" } }),
      db.member.count({ where: { ...scope, joinedAt: { gte: monthStartOf(today(session.user.timeZone)) } } }),
    ]);
  const isFiltered = Boolean(q || groupIds || status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Anggota"
        meta="Data anggota di semua grup dalam scope Anda."
        actions={
          <Link href="/dashboard/anggota/baru" className={buttonVariants({ size: "lg" })}>
            <UserPlus />
            Tambah anggota
          </Link>
        }
      />

      <StatTiles>
        <StatTile icon={Users} label="Total anggota" value={scopeTotal} />
        <StatTile
          icon={UserCheck}
          label="Aktif"
          value={activeTotal}
          hint={scopeTotal > 0 ? `${Math.round((activeTotal / scopeTotal) * 100)}% dari total` : undefined}
        />
        <StatTile icon={UserPlus} label="Bergabung bulan ini" value={joinedThisMonth} />
        <StatTile icon={UsersRound} label="Tidak aktif" value={scopeTotal - activeTotal} hint="Keluar, pindah, meninggal" />
      </StatTiles>

      <TableCard
        title={
          <>
            {isFiltered ? "Hasil filter" : "Semua anggota"}: <span className="font-medium text-foreground">{total} anggota</span>
          </>
        }
        toolbar={
          <>
            <FilterBar
              action="/dashboard/anggota"
              preserve={sortPreserve(sort, DEFAULT_MEMBER_SORT)}
              isFiltered={isFiltered}
              resetHref="/dashboard/anggota"
            >
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
            <ColumnToggle columns={MEMBER_COLUMNS} visible={columns} action={setMemberColumnsAction} />
          </>
        }
        footer={
          total > pageSize ? (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={total}
              hrefFor={(target) => pageHref("/dashboard/anggota", params, target)}
            />
          ) : undefined
        }
      >
        {members.length > 0 ? (
          <MembersTable
            members={members}
            columns={columns}
            sort={sort}
            sortHrefFor={(key) => sortHref("/dashboard/anggota", params, key, sort, DEFAULT_MEMBER_SORT)}
            today={today(session.user.timeZone)}
          />
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada anggota yang cocok.</p>
        )}
      </TableCard>
    </div>
  );
}

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { UserCheck, UserPlus, Users, UsersRound } from "lucide-react";
import { auth } from "@/auth";
import { ColumnToggle } from "@/components/column-toggle";
import { StatTile, StatTiles, TableCard } from "@/components/data-table";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { TagFilter } from "@/components/filters/tag-filter";
import { SortSelect } from "@/components/filters/sort-select";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { monthStartOf, today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, parseSearch, parseTagIds } from "@/lib/filters";
import { MEMBER_COLUMNS_COOKIE, MEMBER_COLUMNS, parseMemberColumns } from "@/lib/member/columns";
import { MEMBER_STATUS_LABELS } from "@/lib/member/labels";
import { DEFAULT_MEMBER_SORT, listMembers, MEMBER_SORT_KEYS } from "@/lib/member/queries";
import { pageHref } from "@/lib/pagination";
import { parseSort, sortHref } from "@/lib/sort";
import { MEMBER_STATUSES, type MemberStatus } from "@/lib/validation/enums";
import { setMemberColumnsAction } from "./actions";
import { MemberHeaderActions } from "./member-header-actions";
import { BulkTagBar } from "@/components/tags/bulk-tag-bar";
import { MemberTagProviders } from "@/components/tags/member-tag-providers";
import { canPickTags, loadTagOptions, visibleTagIds } from "@/lib/tag/entity";
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
  const tagIds = parseTagIds(params.tag);
  const status = typeof params.status === "string" && isMemberStatus(params.status) ? params.status : undefined;
  const page = parsePage(params.page);
  const columns = parseMemberColumns((await cookies()).get(MEMBER_COLUMNS_COOKIE)?.value);
  // Only the name and visible columns can be sorted on: ordering by a hidden column would leak its values.
  const sortable = MEMBER_SORT_KEYS.filter((key) => key === "nama" || (columns as string[]).includes(key));
  const sort = parseSort(params, sortable, DEFAULT_MEMBER_SORT);

  const scope = { group: { path: { startsWith: session.user.groupPath } } };
  const [{ members, total, page: currentPage, pageSize }, groups, scopeTotal, activeTotal, joinedThisMonth, tagOptions] =
    await Promise.all([
      (async () => {
        try {
          return await listMembers(session.user, { search: q, groupIds, tagIds, status, page, sort });
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
      loadTagOptions(session.user),
    ]);
  const isFiltered = Boolean(q || groupIds || tagIds || status);
  // Row pickers need the Tag column; bulk selection only needs a tag to choose from (a bar without one is a dead end).
  const canPickRowTags = columns.includes("tag") && canPickTags(tagOptions);
  const selectable = tagOptions.options.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Anggota"
        meta="Data anggota di semua grup dalam scope Anda."
        actions={<MemberHeaderActions />}
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

      <MemberTagProviders
        options={tagOptions.options}
        canCreate={tagOptions.canCreate}
        bulk={
          selectable
            ? {
                memberIds: members.map((m) => m.id),
                memberTags: Object.fromEntries(members.map((m) => [m.id, m.tags.map((link) => link.tag)])),
              }
            : null
        }
      >
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
              isFiltered={isFiltered}
              resetHref="/dashboard/anggota"
            >
              <SearchFilter value={q} placeholder="Cari nama anggota…" />
              <GroupFilter groups={groups} selected={groupIds ?? []} hint="Termasuk semua grup di bawahnya." />
              {(tagOptions.visible.length > 0 || tagIds) && (
                <TagFilter tags={tagOptions.visible} selected={visibleTagIds(tagOptions.visible, tagIds)} />
              )}
              <SelectFilter
                name="status"
                value={status}
                label="Status"
                allLabel="Semua status"
                options={MEMBER_STATUSES.map((value) => ({ value, label: MEMBER_STATUS_LABELS[value] }))}
              />
              <SortSelect
                options={sortable.map((key) => ({
                  key,
                  label: key === "nama" ? "Nama" : (MEMBER_COLUMNS.find((c) => c.key === key)?.label ?? key),
                }))}
                current={sort}
                fallback={DEFAULT_MEMBER_SORT}
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
            canPickRowTags={canPickRowTags}
            selectable={selectable}
          />
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada anggota yang cocok.</p>
        )}
      </TableCard>
      {selectable && <BulkTagBar />}
      </MemberTagProviders>
    </div>
  );
}

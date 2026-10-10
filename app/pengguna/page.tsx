import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SortableTh, TableCard, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { FilterBar, SearchFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, parseSearch } from "@/lib/filters";
import { pageHref } from "@/lib/pagination";
import { parseSort, sortHref, sortPreserve } from "@/lib/sort";
import { DEFAULT_USER_SORT, listUsers, USER_SORT_KEYS, type UserSortKey } from "@/lib/user/queries";
import { userRowPermissions } from "@/lib/user/row-permissions";
import { cn, initials } from "@/lib/utils";
import { ROLES } from "@/lib/validation/enums";
import { CreateUserDialog } from "./create-user-dialog";
import { ManageUserDialog } from "./manage-user-dialog";

const COLUMNS: { key: UserSortKey; label: string }[] = [
  { key: "username", label: "Username" },
  { key: "peran", label: "Peran" },
  { key: "grup", label: "Grup" },
  { key: "status", label: "Status" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const q = parseSearch(params.q);
  const groupIds = parseGroupIds(params.grup);
  const page = parsePage(params.page);
  const sort = parseSort(params, USER_SORT_KEYS, DEFAULT_USER_SORT);

  const canCreate = session.user.role === "OWNER" || session.user.role === "ADMIN";

  const [{ roles, total, page: currentPage, pageSize }, groups] = await Promise.all([
    (async () => {
      try {
        return await listUsers(session.user, { search: q, groupIds, page, sort });
      } catch (error) {
        if (error instanceof NotFoundError) notFound();
        throw error;
      }
    })(),
    db.group.findMany({
      where: visibleGroupsWhere(session.user),
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, path: true, depth: true },
    }),
  ]);

  const allowedCreateRoles = session.user.role === "OWNER" ? ROLES : ROLES.filter((r) => r !== "OWNER");
  const isFiltered = Boolean(q || groupIds);
  const th = (key: UserSortKey, label: string) => (
    <SortableTh
      key={key}
      label={label}
      href={sortHref("/pengguna", params, key, sort, DEFAULT_USER_SORT)}
      dir={sort.key === key ? sort.dir : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengguna"
        meta="Akun yang bisa masuk ke aplikasi, per grup dalam scope Anda."
        actions={canCreate && <CreateUserDialog groups={groups} allowedRoles={allowedCreateRoles} />}
      />

      <TableCard
        title={
          <>
            {isFiltered ? "Hasil filter" : "Semua pengguna"}:{" "}
            <span className="font-medium text-foreground">{total} pengguna</span>
          </>
        }
        toolbar={
          <FilterBar
            action="/pengguna"
            preserve={sortPreserve(sort, DEFAULT_USER_SORT)}
            isFiltered={isFiltered}
            resetHref="/pengguna"
          >
            <SearchFilter value={q} placeholder="Cari nama atau username…" />
            <GroupFilter groups={groups} selected={groupIds ?? []} hint="Termasuk semua grup di bawahnya." />
          </FilterBar>
        }
        footer={
          total > pageSize ? (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={total}
              hrefFor={(target) => pageHref("/pengguna", params, target)}
            />
          ) : undefined
        }
      >
        {roles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={theadRowClass}>
                  {th("nama", "Nama")}
                  {COLUMNS.map((c) => th(c.key, c.label))}
                  <th scope="col" className={cn(thClass, "w-24")}>
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {roles.map((userRole) => {
                  const role = userRole.role as (typeof ROLES)[number];
                  const { canManage, canReset } = userRowPermissions({
                    viewerRole: session.user.role,
                    viewerGroupId: session.user.groupId,
                    targetRole: role,
                    targetGroupId: userRole.groupId,
                    isSelf: String(userRole.user.id) === session.user.id,
                  });
                  return (
                    <tr key={userRole.id} className={trClass}>
                      <th scope="row" className={cn(tdClass, "text-left font-medium")}>
                        <span className="flex items-center gap-2.5">
                          <Avatar size="sm">
                            <AvatarFallback>{initials(userRole.user.name)}</AvatarFallback>
                          </Avatar>
                          {userRole.user.name}
                        </span>
                      </th>
                      <td className={cn(tdClass, "text-muted-foreground")}>@{userRole.user.username}</td>
                      <td className={tdClass}>
                        <Badge variant="secondary">{role}</Badge>
                      </td>
                      <td className={tdClass}>{userRole.group.name}</td>
                      <td className={tdClass}>
                        {userRole.user.isActive ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Aktif
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {(canManage || canReset) && (
                          <ManageUserDialog
                            userId={userRole.user.id}
                            userName={userRole.user.name}
                            role={role}
                            groupId={userRole.groupId}
                            isActive={userRole.user.isActive}
                            canManage={canManage}
                            canReset={canReset}
                            groups={groups}
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
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {isFiltered ? "Tidak ada pengguna yang cocok." : "Belum ada pengguna."}
          </p>
        )}
      </TableCard>
    </div>
  );
}

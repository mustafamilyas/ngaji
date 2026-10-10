import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/pagination";
import { FilterBar, SearchFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, parseSearch } from "@/lib/filters";
import { pageHref } from "@/lib/pagination";
import { listUsers } from "@/lib/user/queries";
import { ROLES } from "@/lib/validation/enums";
import { userRowPermissions } from "@/lib/user/row-permissions";
import { initials } from "@/lib/utils";
import { CreateUserDialog } from "./create-user-dialog";
import { ManageUserDialog } from "./manage-user-dialog";

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

  const canCreate = session.user.role === "OWNER" || session.user.role === "ADMIN";

  const [{ roles, total, page: currentPage, pageSize }, groups] = await Promise.all([
    (async () => {
      try {
        return await listUsers(session.user, { search: q, groupIds, page });
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengguna"
        meta={`${total} pengguna dalam scope Anda`}
        actions={canCreate && <CreateUserDialog groups={groups} allowedRoles={allowedCreateRoles} />}
      />

      <FilterBar action="/pengguna" isFiltered={Boolean(q || groupIds)} resetHref="/pengguna">
        <SearchFilter value={q} placeholder="Cari nama atau username…" />
        <GroupFilter groups={groups} selected={groupIds ?? []} hint="Termasuk semua grup di bawahnya." />
      </FilterBar>

      <Card>
        <CardContent>
          {roles.length > 0 ? (
            <ul className="flex flex-col divide-y">
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
                  <li key={userRole.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{initials(userRole.user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                          <span className="truncate">{userRole.user.name}</span>
                          <Badge variant="secondary">{role}</Badge>
                          {!userRole.user.isActive && <Badge variant="outline">Nonaktif</Badge>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{userRole.user.username} · {userRole.group.name}
                        </p>
                      </div>
                    </div>
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
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {q || groupIds ? "Tidak ada pengguna yang cocok." : "Belum ada pengguna."}
            </p>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={total}
        hrefFor={(target) => pageHref("/pengguna", params, target)}
      />
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
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
import { CreateUserForm } from "./create-user-form";
import { UserRowControls } from "./user-row-controls";

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
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Pengguna</h1>

      {canCreate && <CreateUserForm groups={groups} allowedRoles={allowedCreateRoles} />}

      <FilterBar action="/pengguna" isFiltered={Boolean(q || groupIds)} resetHref="/pengguna">
        <SearchFilter value={q} placeholder="Cari nama atau username…" />
        <GroupFilter groups={groups} selected={groupIds ?? []} hint="Termasuk semua grup di bawahnya." />
      </FilterBar>

      <ul className="flex flex-col gap-3">
        {roles.map((userRole) => (
          <li key={userRole.id} className="flex flex-col gap-1 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{userRole.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  @{userRole.user.username} · {userRole.role} · {userRole.group.name}
                </p>
              </div>
              {!userRole.user.isActive && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Nonaktif
                </span>
              )}
            </div>
            <UserRowControls
              userId={userRole.user.id}
              role={userRole.role as (typeof ROLES)[number]}
              groupId={userRole.groupId}
              isActive={userRole.user.isActive}
              isSelf={String(userRole.user.id) === session.user.id}
              viewerRole={session.user.role}
              viewerGroupId={session.user.groupId}
              groups={groups}
            />
          </li>
        ))}
      </ul>

      {roles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {q || groupIds ? "Tidak ada pengguna yang cocok." : "Belum ada pengguna."}
        </p>
      )}

      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={total}
        hrefFor={(target) => pageHref("/pengguna", params, target)}
      />
    </div>
  );
}

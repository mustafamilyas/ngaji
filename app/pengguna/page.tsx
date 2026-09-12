import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { listUsersInScope } from "@/lib/user/queries";
import { ROLES } from "@/lib/validation/enums";
import { CreateUserForm } from "./create-user-form";
import { UserRowControls } from "./user-row-controls";

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canCreate = session.user.role === "OWNER" || session.user.role === "ADMIN";

  const [roles, groups] = await Promise.all([
    listUsersInScope(session.user),
    db.group.findMany({
      where: visibleGroupsWhere(session.user),
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      select: { id: true, name: true, depth: true },
    }),
  ]);

  const allowedCreateRoles = session.user.role === "OWNER" ? ROLES : ROLES.filter((r) => r !== "OWNER");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Pengguna</h1>

      {canCreate && <CreateUserForm groups={groups} allowedRoles={allowedCreateRoles} />}

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

      {roles.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pengguna.</p>}
    </div>
  );
}

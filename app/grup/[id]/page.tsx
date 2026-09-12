import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { getLevels } from "@/lib/group/levels";
import { resolveGroup } from "@/lib/resolve";
import { AddSubgroupForm } from "./add-subgroup-form";
import { DeleteGroupForm } from "./delete-group-form";
import { RenameGroupForm } from "./rename-group-form";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isInteger(groupId)) notFound();

  const session = await auth();
  if (!session) redirect("/login");

  let group;
  try {
    group = await resolveGroup(session.user, groupId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [children, members, activities, userRoles, levels] = await Promise.all([
    db.group.findMany({ where: { parentId: group.id }, orderBy: { name: "asc" } }),
    db.member.findMany({ where: { groupId: group.id }, orderBy: { name: "asc" } }),
    db.activity.findMany({ where: { groupId: group.id }, orderBy: { name: "asc" } }),
    db.userGroupRole.findMany({
      where: { groupId: group.id },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    getLevels(group.organizationId),
  ]);

  const canEdit = session.user.role === "ADMIN" || session.user.role === "OWNER";
  const maxDepth = levels.length > 0 ? levels[levels.length - 1].depth : 0;
  const isLeaf = group.depth === maxDepth;
  const levelName = levels[group.depth]?.name ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-muted-foreground">{levelName}</p>
        <h1 className="text-lg font-semibold">{group.name}</h1>
      </div>

      {canEdit && (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h2 className="text-sm font-medium">Pengaturan grup</h2>
          <RenameGroupForm groupId={group.id} name={group.name} />
          <DeleteGroupForm groupId={group.id} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Sub-grup ({children.length})</h2>
        {children.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {children.map((child) => (
              <li key={child.id}>
                <Link href={`/grup/${child.id}`} className="text-sm text-primary hover:underline">
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada sub-grup.</p>
        )}
        {canEdit && !isLeaf && (
          <div className="mt-2">
            <AddSubgroupForm parentId={group.id} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Anggota ({members.length})</h2>
        {members.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {members.map((member) => (
              <li key={member.id}>{member.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada anggota.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Kegiatan ({activities.length})</h2>
        {activities.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {activities.map((activity) => (
              <li key={activity.id}>{activity.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada kegiatan.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Pengguna ({userRoles.length})</h2>
        {userRoles.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {userRoles.map((userRole) => (
              <li key={userRole.id}>
                {userRole.user.name} — {userRole.role}
                {!userRole.user.isActive && (
                  <span className="ml-1 text-xs text-muted-foreground">(nonaktif)</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada pengguna.</p>
        )}
      </section>
    </div>
  );
}

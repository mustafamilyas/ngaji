import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Pagination } from "@/components/pagination";
import { EMBEDDED_PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { parsePage } from "@/lib/filters";
import { getLevels } from "@/lib/group/levels";
import { clampPage, pageHref, paginate } from "@/lib/pagination";
import { resolveGroup } from "@/lib/resolve";
import { AddSubgroupForm } from "./add-subgroup-form";
import { DeleteGroupForm } from "./delete-group-form";
import { RenameGroupForm } from "./rename-group-form";

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
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

  const memberTotal = await db.member.count({ where: { groupId: group.id } });
  const memberPage = clampPage(parsePage(query.anggota), memberTotal, EMBEDDED_PAGE_SIZE);

  const [allChildren, members, allActivities, allUserRoles, levels] = await Promise.all([
    db.group.findMany({ where: { parentId: group.id }, orderBy: { name: "asc" } }),
    db.member.findMany({
      where: { groupId: group.id },
      orderBy: { name: "asc" },
      skip: (memberPage - 1) * EMBEDDED_PAGE_SIZE,
      take: EMBEDDED_PAGE_SIZE,
    }),
    db.activity.findMany({ where: { groupId: group.id }, orderBy: { name: "asc" } }),
    db.userGroupRole.findMany({
      where: { groupId: group.id },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    getLevels(group.organizationId),
  ]);

  const children = paginate(allChildren, parsePage(query.subgrup), EMBEDDED_PAGE_SIZE);
  const activities = paginate(allActivities, parsePage(query.kegiatan), EMBEDDED_PAGE_SIZE);
  const userRoles = paginate(allUserRoles, parsePage(query.pengguna), EMBEDDED_PAGE_SIZE);
  const path = `/grup/${group.id}`;

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
        <h2 className="text-sm font-medium">Sub-grup ({children.total})</h2>
        {children.total > 0 ? (
          <ul className="flex flex-col gap-1">
            {children.items.map((child) => (
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
        <Pagination
          {...children}
          scroll={false}
          hrefFor={(target) => pageHref(path, query, target, "subgrup")}
        />
        {canEdit && !isLeaf && (
          <div className="mt-2">
            <AddSubgroupForm parentId={group.id} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Anggota ({memberTotal})</h2>
          {memberTotal > 0 && (
            <Link href={`/anggota?grup=${group.id}`} className="text-xs text-primary hover:underline">
              Buka di daftar anggota
            </Link>
          )}
        </div>
        {members.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {members.map((member) => (
              <li key={member.id}>
                <Link href={`/anggota/${member.id}`} className="hover:underline">
                  {member.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada anggota.</p>
        )}
        <Pagination
          page={memberPage}
          pageSize={EMBEDDED_PAGE_SIZE}
          total={memberTotal}
          scroll={false}
          hrefFor={(target) => pageHref(path, query, target, "anggota")}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Kegiatan ({activities.total})</h2>
        {activities.total > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {activities.items.map((activity) => (
              <li key={activity.id}>
                <Link href={`/kegiatan/${activity.id}`} className="hover:underline">
                  {activity.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada kegiatan.</p>
        )}
        <Pagination
          {...activities}
          scroll={false}
          hrefFor={(target) => pageHref(path, query, target, "kegiatan")}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Pengguna ({userRoles.total})</h2>
        {userRoles.total > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {userRoles.items.map((userRole) => (
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
        <Pagination
          {...userRoles}
          scroll={false}
          hrefFor={(target) => pageHref(path, query, target, "pengguna")}
        />
      </section>
    </div>
  );
}

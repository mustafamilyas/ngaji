import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { getLevels } from "@/lib/group/levels";

type GroupRow = { id: number; parentId: number | null; name: string; depth: number };

function GroupTreeNode({
  group,
  childrenByParent,
  levelNames,
}: {
  group: GroupRow;
  childrenByParent: Map<number, GroupRow[]>;
  levelNames: string[];
}) {
  const children = childrenByParent.get(group.id) ?? [];
  return (
    <li>
      <Link
        href={`/grup/${group.id}`}
        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
      >
        <span>{group.name}</span>
        <span className="text-xs text-muted-foreground">{levelNames[group.depth] ?? ""}</span>
      </Link>
      {children.length > 0 && (
        <ul className="ml-4 border-l pl-2">
          {children.map((child) => (
            <GroupTreeNode
              key={child.id}
              group={child}
              childrenByParent={childrenByParent}
              levelNames={levelNames}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function GroupTreePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const ownGroup = await db.group.findUnique({
    where: { id: session.user.groupId },
    select: { organizationId: true },
  });

  const [groups, levels] = await Promise.all([
    db.group.findMany({
      where: visibleGroupsWhere(session.user),
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, depth: true },
    }),
    ownGroup ? getLevels(ownGroup.organizationId) : Promise.resolve([]),
  ]);

  const levelNames = levels.map((level) => level.name);
  const childrenByParent = new Map<number, GroupRow[]>();
  for (const group of groups) {
    if (group.parentId === null) continue;
    const siblings = childrenByParent.get(group.parentId) ?? [];
    siblings.push(group);
    childrenByParent.set(group.parentId, siblings);
  }

  const root = groups.find((group) => group.id === session.user.groupId);
  const isRootOwner = session.user.role === "OWNER" && root?.depth === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Grup</h1>
        {isRootOwner && (
          <Link href="/pengaturan/jenjang" className="text-sm text-primary hover:underline">
            Pengaturan jenjang
          </Link>
        )}
      </div>
      {root ? (
        <ul>
          <GroupTreeNode group={root} childrenByParent={childrenByParent} levelNames={levelNames} />
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Grup tidak ditemukan.</p>
      )}
    </div>
  );
}

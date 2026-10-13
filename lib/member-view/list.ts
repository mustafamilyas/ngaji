import type { SessionUser } from "@/lib/auth/session-user";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { clampPage } from "@/lib/pagination";

export type MemberViewRow = {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  updatedAt: Date;
  /** Owner is deactivated or moved to another group; an ADMIN+ of the group may take the view over. */
  orphaned: boolean;
};

/**
 * Views of the viewer's *exact* group (never ancestors or descendants), for
 * `/dashboard/tampilan`. The group comes from the session, not from the client.
 * Sorted by name; `search` is a trimmed, ASCII case-insensitive substring match.
 */
export async function listMemberViews(
  session: SessionUser,
  options: { search?: string; page?: number } = {},
) {
  const search = options.search?.trim();
  const where = {
    groupId: session.groupId,
    deletedAt: null,
    ...(search && { name: { contains: search } }),
  };

  const total = await db.memberView.count({ where });
  const page = clampPage(options.page ?? 1, total, PAGE_SIZE);
  const rows = await db.memberView.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      ownerId: true,
      groupId: true,
      updatedAt: true,
      owner: { select: { name: true, isActive: true, role: { select: { groupId: true } } } },
    },
  });

  const views: MemberViewRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    ownerName: row.owner.name,
    updatedAt: row.updatedAt,
    orphaned: !row.owner.isActive || row.owner.role?.groupId !== row.groupId,
  }));

  return { views, total, page, pageSize: PAGE_SIZE };
}

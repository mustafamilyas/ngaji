import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { RenameLevelInput } from "@/lib/validation/level";

/**
 * Levels are the fixed depth ladder for one organization (DESIGN.md §1 is a
 * single-organization deployment, but `organizationId` is required rather
 * than queried org-wide: `Level` rows carry no other scoping column, so an
 * unfiltered query is only ever safe because production has exactly one
 * organization — passing the id explicitly keeps that an invariant this
 * function enforces rather than one it quietly assumes).
 */
export async function getLevels(organizationId: number) {
  return db.level.findMany({ where: { organizationId }, orderBy: { depth: "asc" } });
}

/** A group is a leaf (can hold members, cannot hold children) at the deepest configured depth. */
export async function getMaxDepth(organizationId: number): Promise<number> {
  const levels = await getLevels(organizationId);
  return levels.length > 0 ? levels[levels.length - 1].depth : 0;
}

/** Leaf groups (the only groups members can belong to) within the caller's scope, e.g. for a member-creation group picker. */
export async function listLeafGroupsInScope(session: SessionUser) {
  const own = await db.group.findUnique({ where: { id: session.groupId }, select: { organizationId: true } });
  if (!own) return [];

  const maxDepth = await getMaxDepth(own.organizationId);
  return db.group.findMany({
    where: { depth: maxDepth, path: { startsWith: session.groupPath } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** DESIGN.md §3.2/§3.5: OWNER whose own group is the org's root only. */
export async function renameLevel(session: SessionUser, input: RenameLevelInput) {
  authorize(session, "level.rename");

  const rootGroup = await db.group.findUnique({ where: { id: session.groupId } });
  if (!rootGroup) throw new NotFoundError();

  const level = await db.level.findUnique({
    where: { organizationId_depth: { organizationId: rootGroup.organizationId, depth: input.depth } },
  });
  if (!level) throw new NotFoundError();

  return db.$transaction(async (tx) => {
    const updated = await tx.level.update({ where: { id: level.id }, data: { name: input.name } });
    await audit(tx, {
      actorId: Number(session.id),
      action: "level.rename",
      entity: "Level",
      entityId: level.id,
      groupId: session.groupId,
      before: { name: level.name },
      after: { name: updated.name },
    });
    return updated;
  });
}

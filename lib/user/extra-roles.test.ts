import { afterAll, describe, expect, it } from "vitest";
import { createActivity, updateActivity } from "@/lib/activity/mutations";
import { revalidateSessionUser } from "@/lib/auth/revalidate";
import { canEditActivity } from "@/lib/authz";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { addExtraRole, moveUser, removeExtraRole } from "./mutations";

const template = {
  name: "Kajian",
  location: "Aula",
  startTime: "19:00",
  durationMinutes: 60,
  freq: "ONCE" as const,
  interval: 1,
  weekdays: [],
  startsOn: "2026-03-02",
  endsOn: "2026-03-02",
};

/** A USER whose primary role is the branch group, plus a session for the OWNER acting on them. */
async function setup(label: string) {
  const fixture = await buildPageFixture(label);
  const target = await db.user.create({ data: { username: `${label}-target`, passwordHash: "x", name: "Target" } });
  await db.userGroupRole.create({ data: { userId: target.id, groupId: fixture.branch.id, role: "USER" } });
  const owner = sessionFor(fixture.actorId, "OWNER", fixture.root);
  return { fixture, target, owner };
}

describe("additional ADMIN roles", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("lets an OWNER add a role below the primary group, and shows it in the revalidated session", async () => {
    const { fixture, target, owner } = await setup("xr-add");

    await addExtraRole(owner, { userId: target.id, groupId: fixture.leaf.id, role: "ADMIN" });

    const session = await revalidateSessionUser(target.id, 0);
    expect(session?.extraRoles).toEqual([{ groupId: fixture.leaf.id, role: "ADMIN" }]);
    expect(session?.role).toBe("USER");
    expect(session?.groupId).toBe(fixture.branch.id);
  });

  it("rejects the primary group, a group outside the primary scope and a duplicate", async () => {
    const { fixture, target, owner } = await setup("xr-invalid");

    await expect(addExtraRole(owner, { userId: target.id, groupId: fixture.branch.id, role: "ADMIN" })).rejects.toBeInstanceOf(ValidationError);
    await expect(addExtraRole(owner, { userId: target.id, groupId: fixture.root.id, role: "ADMIN" })).rejects.toBeInstanceOf(ValidationError);
    await addExtraRole(owner, { userId: target.id, groupId: fixture.leaf.id, role: "ADMIN" });
    await expect(addExtraRole(owner, { userId: target.id, groupId: fixture.leaf.id, role: "ADMIN" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("is OWNER only", async () => {
    const { fixture, target } = await setup("xr-owner-only");
    const admin = sessionFor(fixture.actorId, "ADMIN", fixture.root);

    await expect(addExtraRole(admin, { userId: target.id, groupId: fixture.leaf.id, role: "ADMIN" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("removes a role and audits both changes", async () => {
    const { fixture, target, owner } = await setup("xr-remove");
    await addExtraRole(owner, { userId: target.id, groupId: fixture.leaf.id, role: "ADMIN" });

    await removeExtraRole(owner, { userId: target.id, groupId: fixture.leaf.id });

    expect(await db.userExtraRole.count({ where: { userId: target.id } })).toBe(0);
    const actions = (await db.auditLog.findMany({ where: { entityId: target.id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["user.add_extra_role", "user.remove_extra_role"]));
    await expect(removeExtraRole(owner, { userId: target.id, groupId: fixture.leaf.id })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses to move the primary group away from an additional role", async () => {
    const { fixture, target, owner } = await setup("xr-move");
    await addExtraRole(owner, { userId: target.id, groupId: fixture.leaf.id, role: "ADMIN" });

    await expect(moveUser(owner, { userId: target.id, groupId: fixture.root.id })).resolves.toBeDefined();
    await addExtraRole(owner, { userId: target.id, groupId: fixture.otherLeaf.id, role: "ADMIN" }).catch(() => undefined);
    // Moving to a sibling leaf strands the role at the other leaf, which is no longer below the new primary group.
    await expect(moveUser(owner, { userId: target.id, groupId: fixture.otherLeaf.id })).rejects.toBeInstanceOf(ValidationError);
  });

  it("lets a USER with an ADMIN role at a leaf create and edit activities there only", async () => {
    const { fixture, target, owner } = await setup("xr-activity");
    await addExtraRole(owner, { userId: target.id, groupId: fixture.leaf.id, role: "ADMIN" });
    const session = (await revalidateSessionUser(target.id, 0))!;

    const { activity } = await createActivity(session, { ...template, groupId: fixture.leaf.id });
    expect(activity.groupId).toBe(fixture.leaf.id);
    expect(canEditActivity(session, fixture.leaf.id)).toBe(true);
    await updateActivity(session, activity.id, template);

    await expect(createActivity(session, { ...template, groupId: fixture.otherLeaf.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createActivity(session, { ...template, groupId: fixture.branch.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createActivity(session, { ...template, groupId: fixture.root.id })).rejects.toBeInstanceOf(NotFoundError);
  });
});

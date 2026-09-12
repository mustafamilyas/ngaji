import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { revalidateSessionUser } from "./revalidate";

describe("revalidateSessionUser", () => {
  let groupId: number;
  let otherGroupId: number;

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Revalidate Org" } });
    const group = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "0/" },
    });
    groupId = group.id;
    const otherGroup = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Other", path: "0-other/" },
    });
    otherGroupId = otherGroup.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns the current session claims for an active user", async () => {
    const user = await db.user.create({
      data: { username: "still-active", passwordHash: "x", name: "Still Active" },
    });
    await db.userGroupRole.create({ data: { userId: user.id, groupId, role: "ADMIN" } });

    const result = await revalidateSessionUser(user.id);

    expect(result).toMatchObject({ username: "still-active", role: "ADMIN", groupId, groupPath: "0/" });
  });

  it("returns null once the user has been deactivated mid-session", async () => {
    const user = await db.user.create({
      data: { username: "gets-deactivated", passwordHash: "x", name: "Gets Deactivated" },
    });
    await db.userGroupRole.create({ data: { userId: user.id, groupId, role: "USER" } });

    expect(await revalidateSessionUser(user.id)).not.toBeNull();

    await db.user.update({ where: { id: user.id }, data: { isActive: false } });

    expect(await revalidateSessionUser(user.id)).toBeNull();
  });

  it("reflects a demotion (role change) mid-session without requiring re-login", async () => {
    const user = await db.user.create({
      data: { username: "gets-demoted", passwordHash: "x", name: "Gets Demoted" },
    });
    await db.userGroupRole.create({ data: { userId: user.id, groupId, role: "ADMIN" } });

    const before = await revalidateSessionUser(user.id);
    expect(before?.role).toBe("ADMIN");

    await db.userGroupRole.update({ where: { userId: user.id }, data: { role: "USER" } });

    const after = await revalidateSessionUser(user.id);
    expect(after?.role).toBe("USER");
  });

  it("reflects a move to a different group mid-session", async () => {
    const user = await db.user.create({
      data: { username: "gets-moved", passwordHash: "x", name: "Gets Moved" },
    });
    await db.userGroupRole.create({ data: { userId: user.id, groupId, role: "USER" } });

    const before = await revalidateSessionUser(user.id);
    expect(before?.groupPath).toBe("0/");

    await db.userGroupRole.update({ where: { userId: user.id }, data: { groupId: otherGroupId } });

    const after = await revalidateSessionUser(user.id);
    expect(after?.groupId).toBe(otherGroupId);
    expect(after?.groupPath).toBe("0-other/");
  });

  it("returns null for a user id that no longer exists", async () => {
    expect(await revalidateSessionUser(999_999)).toBeNull();
  });
});

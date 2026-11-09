import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { type FixtureGroup, mockAuthSession, sessionFor } from "@/lib/test/fixtures";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { auth } from "@/auth";
import { createMemberAction } from "./actions";

describe("member actions while mustChangePassword is set", () => {
  let group: FixtureGroup;
  let userId: number;

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Gate Org" } });
    await db.level.create({ data: { organizationId: organization.id, depth: 0, name: "Kelompok" } });
    const created = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Leaf", path: "gate-0/" },
    });
    group = { id: created.id, path: created.path, organizationId: created.organizationId };
    const user = await db.user.create({
      data: { username: "gate-user", passwordHash: "x", name: "Gate", mustChangePassword: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("create-member action refused while mustChangePassword", async () => {
    mockAuthSession(auth, {
      user: { ...sessionFor(userId, "ADMIN", group), mustChangePassword: true },
    });

    await expect(
      createMemberAction({ groupId: group.id, name: "Seharusnya Tidak Ada", sex: "L" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await db.member.count({ where: { name: "Seharusnya Tidak Ada" } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "member.create", actorId: userId } })).toBe(0);
  });
});

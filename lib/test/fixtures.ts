import type { Session } from "@auth/core/types";
import type { Mock } from "vitest";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { addDays, today, weekdayOf } from "@/lib/dates";

/** Hand-built `SessionUser` — no real login/JWT involved, just the shape every `lib/**` and page function expects. */
export function sessionFor(
  actorId: number,
  role: SessionUser["role"],
  group: { id: number; path: string },
): SessionUser {
  return {
    id: String(actorId),
    username: `tester-${actorId}`,
    name: "Tester",
    role,
    groupId: group.id,
    groupPath: group.path,
    mustChangePassword: false,
  };
}

/**
 * Sets what a `vi.mock("@/auth", () => ({ auth: vi.fn() }))`-mocked `auth()`
 * resolves to. `auth`'s real export is overloaded (it also wraps a
 * middleware handler in `middleware.ts`), which trips up `vi.mocked()`'s
 * overload resolution — this sidesteps that with one explicit, non-`any` cast.
 */
export function mockAuthSession(authFn: unknown, session: { user: SessionUser } | null): void {
  const value: Session | null = session && { ...session, expires: "2999-01-01T00:00:00.000Z" };
  (authFn as Mock<() => Promise<Session | null>>).mockResolvedValue(value);
}

export type PageFixture = {
  organizationId: number;
  root: { id: number; path: string };
  branch: { id: number; path: string };
  leaf: { id: number; path: string };
  otherLeaf: { id: number; path: string };
  actorId: number;
  memberId: number;
  activityId: number;
};

/**
 * A Root -> Branch -> Leaf group tree (matching DESIGN.md's materialized-path
 * scheme), plus one member and one weekly activity in `leaf`, for page-level
 * rendering tests. `label` must be unique per test file — `test.db` is shared
 * across the whole run and never reset between files (`fileParallelism:
 * false` in `vitest.config.mts` keeps that safe).
 */
export async function buildPageFixture(label: string): Promise<PageFixture> {
  const actor = await db.user.create({
    data: { username: `${label}-actor`, passwordHash: "x", name: "Actor" },
  });

  const organization = await db.organization.create({ data: { name: `${label} Org` } });
  for (const [depth, name] of ["Root", "Branch", "Leaf"].entries()) {
    await db.level.create({ data: { organizationId: organization.id, depth, name } });
  }

  const rootRow = await db.group.create({
    data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
  });
  const root = await db.group.update({ where: { id: rootRow.id }, data: { path: `${rootRow.id}/` } });

  const branchRow = await db.group.create({
    data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Branch", path: "" },
  });
  const branch = await db.group.update({
    where: { id: branchRow.id },
    data: { path: `${root.path}${branchRow.id}/` },
  });

  const leafRow = await db.group.create({
    data: { organizationId: organization.id, parentId: branch.id, depth: 2, name: "Leaf", path: "" },
  });
  const leaf = await db.group.update({
    where: { id: leafRow.id },
    data: { path: `${branch.path}${leafRow.id}/` },
  });

  const otherLeafRow = await db.group.create({
    data: { organizationId: organization.id, parentId: branch.id, depth: 2, name: "Other Leaf", path: "" },
  });
  const otherLeaf = await db.group.update({
    where: { id: otherLeafRow.id },
    data: { path: `${branch.path}${otherLeafRow.id}/` },
  });

  const member = await db.member.create({
    data: {
      groupId: leaf.id,
      name: "Anggota Uji",
      birthPlace: "Jakarta",
      birthDate: "2000-01-01",
      sex: "L",
      address: "Jl. Uji No. 1",
      phone: "081200000000",
      maritalStatus: "BELUM_MENIKAH",
      workStatus: "BEKERJA",
      status: "AKTIF",
      joinedAt: "2024-01-01",
      createdById: actor.id,
    },
  });

  const activity = await db.activity.create({
    data: {
      groupId: leaf.id,
      name: "Kajian Uji",
      location: "Aula",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [weekdayOf(today())],
      startsOn: addDays(today(), -30),
      createdById: actor.id,
    },
  });

  return {
    organizationId: organization.id,
    root,
    branch,
    leaf,
    otherLeaf,
    actorId: actor.id,
    memberId: member.id,
    activityId: activity.id,
  };
}

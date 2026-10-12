import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import { emptyDefinition } from "@/lib/validation/member-view";
import { loadSectionAction } from "./actions";

describe("loadSectionAction", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  async function setup(label: string) {
    const fixture = await buildPageFixture(label);
    const owner = await db.user.create({ data: { username: `${label}-owner`, passwordHash: "x", name: "Pemilik" } });
    await db.userGroupRole.create({ data: { userId: owner.id, groupId: fixture.leaf.id, role: "USER" } });
    const definition = { ...emptyDefinition(), columns: ["status"], groupBy: { kind: "property", field: "sex" } };
    const view = await db.memberView.create({
      data: {
        groupId: fixture.leaf.id,
        ownerId: owner.id,
        createdById: owner.id,
        name: "Aksi",
        definition: definition as unknown as Prisma.InputJsonValue,
      },
    });
    return { fixture, owner, view };
  }

  it("returns a section page without columns the view did not choose", async () => {
    const { fixture, owner, view } = await setup("tampilan-act-ok");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    const result = await loadSectionAction({ viewId: view.id, key: "p:L", offset: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.members.map((m) => m.name)).toEqual(["Anggota Uji"]);
    expect(result.data.hasMore).toBe(false);
    expect(JSON.stringify(result.data.members)).not.toContain("081200000000");
  });

  it("refuses a user outside the view's group", async () => {
    const { fixture, view } = await setup("tampilan-act-scope");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });

    const result = await loadSectionAction({ viewId: view.id, key: "p:L", offset: 0 });
    expect(result.ok).toBe(false);
  });

  it("refuses an unknown section key and malformed input", async () => {
    const { fixture, owner, view } = await setup("tampilan-act-bad");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    expect((await loadSectionAction({ viewId: view.id, key: "p:HILANG", offset: 0 })).ok).toBe(false);
    expect((await loadSectionAction({ viewId: view.id, key: "p:L", offset: -1 })).ok).toBe(false);
    expect((await loadSectionAction({ viewId: "x", key: "p:L", offset: 0 })).ok).toBe(false);
  });
});

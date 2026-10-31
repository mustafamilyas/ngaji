import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import { emptyDefinition } from "@/lib/validation/member-view";
import {
  createMemberViewAction,
  deleteMemberViewAction,
  loadSectionAction,
  transferMemberViewAction,
  updateMemberViewAction,
} from "./actions";

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

describe("view mutation actions", () => {
  async function setup(label: string) {
    const fixture = await buildPageFixture(label);
    const owner = await db.user.create({ data: { username: `${label}-owner`, passwordHash: "x", name: "Pemilik" } });
    await db.userGroupRole.create({ data: { userId: owner.id, groupId: fixture.leaf.id, role: "USER" } });
    const view = await db.memberView.create({
      data: {
        groupId: fixture.leaf.id,
        ownerId: owner.id,
        createdById: owner.id,
        name: "Awal",
        definition: emptyDefinition() as unknown as Prisma.InputJsonValue,
      },
    });
    return { fixture, owner, view };
  }

  it("creates a view in the caller's group and ignores a client groupId", async () => {
    const { fixture, owner } = await setup("tampilan-create");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    const result = await createMemberViewAction({
      name: "Baru",
      definition: emptyDefinition(),
      groupId: fixture.otherLeaf.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved = await db.memberView.findUniqueOrThrow({ where: { id: result.data.id } });
    expect(saved.groupId).toBe(fixture.leaf.id);
    expect(saved.ownerId).toBe(owner.id);
  });

  it("rejects an invalid name and an invalid definition", async () => {
    const { fixture, owner } = await setup("tampilan-create-bad");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    expect((await createMemberViewAction({ name: "  ", definition: emptyDefinition() })).ok).toBe(false);
    expect((await createMemberViewAction({ name: "X", definition: { version: 1, bogus: true } })).ok).toBe(false);
    expect((await createMemberViewAction({ name: "Unik", definition: emptyDefinition() })).ok).toBe(true);
    expect((await createMemberViewAction({ name: "unik", definition: emptyDefinition() })).ok).toBe(false);
  });

  it("lets the owner rename and delete, and refuses a non-owner ADMIN", async () => {
    const { fixture, owner, view } = await setup("tampilan-owner-only");

    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });
    expect((await updateMemberViewAction({ viewId: view.id, name: "Dibajak" })).ok).toBe(false);
    expect((await deleteMemberViewAction({ viewId: view.id })).ok).toBe(false);

    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
    expect((await updateMemberViewAction({ viewId: view.id, name: "Diganti" })).ok).toBe(true);
    expect((await db.memberView.findUniqueOrThrow({ where: { id: view.id } })).name).toBe("Diganti");
    expect((await deleteMemberViewAction({ viewId: view.id })).ok).toBe(true);
    expect((await db.memberView.findUniqueOrThrow({ where: { id: view.id } })).deletedAt).not.toBeNull();
  });

  it("transfers an orphaned view to an ADMIN of the group, but not an active owner's", async () => {
    const { fixture, owner, view } = await setup("tampilan-transfer");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });
    expect((await transferMemberViewAction({ viewId: view.id })).ok).toBe(false);

    await db.user.update({ where: { id: owner.id }, data: { isActive: false } });
    expect((await transferMemberViewAction({ viewId: view.id })).ok).toBe(true);
    expect((await db.memberView.findUniqueOrThrow({ where: { id: view.id } })).ownerId).toBe(fixture.actorId);
  });
});

describe("tag rules in saved views", () => {
  const tagRuleDefinition = (tagId: number) => ({
    ...emptyDefinition(),
    filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "tag", operator: "hasAnyOf", value: [tagId] }] }] },
  });

  async function setup(label: string) {
    const fixture = await buildPageFixture(label);
    const newTag = (groupId: number, key: string, extra: { deletedAt?: Date } = {}) =>
      db.tag.create({ data: { groupId, key, color: "blue", createdById: fixture.actorId, ...extra } });
    return { fixture, newTag, viewCount: (name: string) => db.memberView.count({ where: { name } }) };
  }

  it("saves a tag inherited from an ancestor", async () => {
    const { fixture, newTag } = await setup("tampilan-tag-inherited");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });
    const tag = await newTag(fixture.branch.id, "diwarisi");
    expect((await createMemberViewAction({ name: "Warisan", definition: tagRuleDefinition(tag.id) })).ok).toBe(true);
  });

  it("saves a tag owned by a descendant group", async () => {
    const { fixture, newTag } = await setup("tampilan-tag-descendant");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.branch) });
    const tag = await newTag(fixture.leaf.id, "turunan");
    expect((await createMemberViewAction({ name: "Turunan", definition: tagRuleDefinition(tag.id) })).ok).toBe(true);
  });

  it("rejects a sibling's tag and writes nothing", async () => {
    const { fixture, newTag, viewCount } = await setup("tampilan-tag-sibling");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });
    const tag = await newTag(fixture.otherLeaf.id, "saudara");
    expect((await createMemberViewAction({ name: "Saudara", definition: tagRuleDefinition(tag.id) })).ok).toBe(false);
    expect(await viewCount("Saudara")).toBe(0);
  });

  it("rejects a deleted tag and writes nothing", async () => {
    const { fixture, newTag, viewCount } = await setup("tampilan-tag-deleted");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });
    const tag = await newTag(fixture.leaf.id, "terhapus", { deletedAt: new Date() });
    expect((await createMemberViewAction({ name: "Terhapus", definition: tagRuleDefinition(tag.id) })).ok).toBe(false);
    expect(await viewCount("Terhapus")).toBe(0);
  });

  it("rejects another organization's tag with the same error as an unknown id", async () => {
    const { fixture, viewCount } = await setup("tampilan-tag-foreign");
    const foreign = await buildPageFixture("tampilan-tag-foreign-org");
    const foreignTag = await db.tag.create({ data: { groupId: foreign.leaf.id, key: "asing", color: "blue", createdById: foreign.actorId } });
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });

    const foreignResult = await createMemberViewAction({ name: "Asing", definition: tagRuleDefinition(foreignTag.id) });
    const unknownResult = await createMemberViewAction({ name: "Asing", definition: tagRuleDefinition(999_999_999) });
    expect(foreignResult.ok).toBe(false);
    expect(foreignResult).toEqual(unknownResult);
    expect(await viewCount("Asing")).toBe(0);
  });
});

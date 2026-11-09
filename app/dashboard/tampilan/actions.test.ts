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

describe("summaries in saved views", () => {
  const sex = { dimension: { kind: "property", field: "sex" } } as const;
  const withSummaries = (...summaries: unknown[]) => ({ ...emptyDefinition(), summaries });

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
    const newTag = (groupId: number, key: string, value: string | null) =>
      db.tag.create({ data: { groupId, key, value, color: "blue", createdById: fixture.actorId } });
    const savedDefinition = async () => (await db.memberView.findUniqueOrThrow({ where: { id: view.id } })).definition;
    return { fixture, owner, view, newTag, savedDefinition };
  }

  it("lets the owner save summaries and writes them to the audit log", async () => {
    const { fixture, owner, view, newTag, savedDefinition } = await setup("tampilan-sum-owner");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
    const tag = await newTag(fixture.branch.id, "prioritas", "tinggi");
    const definition = withSummaries(sex, { dimension: { kind: "tagKey", tagId: tag.id } });

    expect((await updateMemberViewAction({ viewId: view.id, definition })).ok).toBe(true);
    expect(await savedDefinition()).toMatchObject({ summaries: definition.summaries });
    const entry = await db.auditLog.findFirstOrThrow({ where: { entity: "MemberView", entityId: view.id, action: "member_view.update" } });
    expect(JSON.stringify(entry.after)).toContain("tagKey");
  });

  it("rejects a non-owner ADMIN adding a summary and changes nothing", async () => {
    const { fixture, view, savedDefinition } = await setup("tampilan-sum-nonowner");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });
    const before = await savedDefinition();
    const result = await updateMemberViewAction({ viewId: view.id, definition: withSummaries(sex) });
    expect(result.ok).toBe(false);
    expect(await savedDefinition()).toEqual(before);
  });

  it("keeps summaries when saving as new, under the caller's group and ownership", async () => {
    const { fixture, owner } = await setup("tampilan-sum-copy");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
    const result = await createMemberViewAction({ name: "Salinan", definition: withSummaries(sex) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved = await db.memberView.findUniqueOrThrow({ where: { id: result.data.id } });
    expect(saved).toMatchObject({ groupId: fixture.leaf.id, ownerId: owner.id });
    expect(saved.definition).toMatchObject({ summaries: [sex] });
  });

  it("rejects a summary on a sibling's tag key and writes nothing", async () => {
    const { fixture, owner, view, newTag, savedDefinition } = await setup("tampilan-sum-sibling");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
    const sibling = await newTag(fixture.otherLeaf.id, "saudara", "x");
    const before = await savedDefinition();
    const definition = withSummaries({ dimension: { kind: "tagKey", tagId: sibling.id } });

    expect((await updateMemberViewAction({ viewId: view.id, definition })).ok).toBe(false);
    expect(await savedDefinition()).toEqual(before);
    expect((await createMemberViewAction({ name: "Saudara", definition })).ok).toBe(false);
    expect(await db.memberView.count({ where: { name: "Saudara" } })).toBe(0);
  });

  it("rejects a deleted tag and a tag of another organization with the same error as an unknown id", async () => {
    const { fixture, owner, newTag } = await setup("tampilan-sum-gone");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
    const gone = await newTag(fixture.leaf.id, "terhapus", null);
    await db.tag.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    const foreign = await buildPageFixture("tampilan-sum-gone-org");
    const foreignTag = await db.tag.create({ data: { groupId: foreign.leaf.id, key: "asing", color: "blue", createdById: foreign.actorId } });
    const attempt = (tagId: number) => createMemberViewAction({ name: "X", definition: withSummaries({ dimension: { kind: "tag", tagId } }) });

    const unknown = await attempt(999_999_999);
    expect(unknown.ok).toBe(false);
    expect(await attempt(gone.id)).toEqual(unknown);
    expect(await attempt(foreignTag.id)).toEqual(unknown);
  });

  it("rejects an org level above the caller's own group, accepts their own level and below", async () => {
    const { fixture, owner } = await setup("tampilan-sum-level");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
    const level = (depth: number) => withSummaries({ dimension: { kind: "groupLevel", depth } });

    expect((await createMemberViewAction({ name: "Atas", definition: level(1) })).ok).toBe(false);
    expect((await createMemberViewAction({ name: "Atas0", definition: level(0) })).ok).toBe(false);
    expect((await createMemberViewAction({ name: "Sendiri", definition: level(2) })).ok).toBe(true);
    expect(await db.memberView.count({ where: { name: { in: ["Atas", "Atas0"] } } })).toBe(0);
  });

  it("rejects more than the maximum number of summaries", async () => {
    const { fixture, owner } = await setup("tampilan-sum-many");
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
    const seven = withSummaries(...Array.from({ length: 7 }, () => sex));
    expect((await createMemberViewAction({ name: "Terlalu banyak", definition: seven })).ok).toBe(false);
  });
});

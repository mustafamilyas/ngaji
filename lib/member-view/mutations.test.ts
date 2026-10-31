import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { buildPageFixture, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import {
  createMemberViewSchema,
  emptyDefinition,
  newViewDefinition,
  updateMemberViewSchema,
  type Definition,
} from "@/lib/validation/member-view";
import { createMemberView, deleteMemberView, transferMemberView, updateMemberView } from "./mutations";

// Lets one test make the audit insert throw, to prove the mutation rolls back with it.
const auditControl = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...actual,
    audit: (...args: Parameters<typeof actual.audit>) => {
      if (auditControl.fail) throw new Error("audit failed");
      return actual.audit(...args);
    },
  };
});

let fx: PageFixture;
let ownerId: number;
let otherUserId: number;
let ownerSession: ReturnType<typeof sessionFor>;
let otherAdminSession: ReturnType<typeof sessionFor>;
let otherUserSession: ReturnType<typeof sessionFor>;
let branchSession: ReturnType<typeof sessionFor>;
let nameSeq = 0;

const uniqueName = (prefix = "Tampilan") => `${prefix} ${++nameSeq}`;

async function makeUser(username: string, groupId: number, role: "OWNER" | "ADMIN" | "USER", isActive = true) {
  const user = await db.user.create({ data: { username, passwordHash: "x", name: username, isActive } });
  await db.userGroupRole.create({ data: { userId: user.id, groupId, role } });
  return user;
}

async function viewRow(id: number) {
  return db.memberView.findFirst({ where: { id } });
}

async function auditFor(action: string, viewId: number) {
  return db.auditLog.findMany({ where: { action, entity: "MemberView", entityId: viewId } });
}

const withAge = (min: number): Definition => ({
  ...emptyDefinition(),
  filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "age", operator: "gte", value: min }] }] },
});

describe("lib/member-view/mutations", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("view-mutations");
    const leafOwner = await makeUser("view-mut-owner", fx.leaf.id, "USER");
    const leafAdmin = await makeUser("view-mut-admin", fx.leaf.id, "ADMIN");
    const leafUser = await makeUser("view-mut-user", fx.leaf.id, "USER");
    ownerId = leafOwner.id;
    otherUserId = leafAdmin.id;
    ownerSession = sessionFor(leafOwner.id, "USER", fx.leaf);
    otherAdminSession = sessionFor(leafAdmin.id, "ADMIN", fx.leaf);
    otherUserSession = sessionFor(leafUser.id, "USER", fx.leaf);
    branchSession = sessionFor(fx.actorId, "OWNER", fx.branch);
  });

  beforeEach(() => {
    auditControl.fail = false;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("createMemberView", () => {
    it("saves into the session's group with the creator as owner, and audits it", async () => {
      const name = uniqueName();
      const view = await createMemberView(ownerSession, { name, definition: newViewDefinition(), source: "member", visibility: "GROUP" });

      expect(view).toMatchObject({ groupId: fx.leaf.id, ownerId, createdById: ownerId, name, source: "member", visibility: "GROUP" });
      const [entry] = await auditFor("member_view.create", view.id);
      expect(entry).toMatchObject({ actorId: ownerId, groupId: fx.leaf.id });
      expect(entry.after).toMatchObject({ name, source: "member", visibility: "GROUP", definition: newViewDefinition() });
    });

    it("lets a plain USER create a view", async () => {
      const view = await createMemberView(otherUserSession, createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }));
      expect(view).toMatchObject({ ownerId: Number(otherUserSession.id), createdById: Number(otherUserSession.id) });
    });

    it("ignores a groupId in the payload", async () => {
      const payload = { name: uniqueName(), definition: emptyDefinition(), groupId: fx.otherLeaf.id };
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse(payload));
      expect(view.groupId).toBe(fx.leaf.id);
    });

    it("rejects a duplicate name in the same group, case-insensitively", async () => {
      const name = uniqueName("Remaja Aktif");
      await createMemberView(ownerSession, createMemberViewSchema.parse({ name, definition: emptyDefinition() }));
      const before = await db.memberView.count({ where: { groupId: fx.leaf.id } });

      await expect(
        createMemberView(otherUserSession, createMemberViewSchema.parse({ name: ` ${name.toUpperCase()} `, definition: emptyDefinition() })),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(await db.memberView.count({ where: { groupId: fx.leaf.id } })).toBe(before);
    });

    it("allows the same name in a different group", async () => {
      const name = uniqueName();
      await createMemberView(ownerSession, createMemberViewSchema.parse({ name, definition: emptyDefinition() }));
      const view = await createMemberView(branchSession, createMemberViewSchema.parse({ name, definition: emptyDefinition() }));
      expect(view.groupId).toBe(fx.branch.id);
    });

    it("lets a deleted view's name be reused", async () => {
      const name = uniqueName();
      const first = await createMemberView(ownerSession, createMemberViewSchema.parse({ name, definition: emptyDefinition() }));
      await deleteMemberView(ownerSession, { viewId: first.id });

      const second = await createMemberView(ownerSession, createMemberViewSchema.parse({ name, definition: emptyDefinition() }));
      expect(second.id).not.toBe(first.id);
    });

    it("rejects a definition with a group outside the viewer's scope", async () => {
      const outside: Definition = {
        ...emptyDefinition(),
        filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "group", operator: "inSubtreeOf", value: [fx.root.id] }] }] },
      };
      await expect(createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: outside }))).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    describe("tag rules", () => {
      const withTag = (tagId: number): Definition => ({
        ...emptyDefinition(),
        filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "tag", operator: "hasAnyOf", value: [tagId] }] }] },
      });
      const newTag = (groupId: number, key: string) => db.tag.create({ data: { groupId, key, color: "blue", createdById: fx.actorId } });

      it("accepts a tag inherited from an ancestor group", async () => {
        const inherited = await newTag(fx.branch.id, "view-inherited");
        const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: withTag(inherited.id) }));
        expect(view.id).toBeGreaterThan(0);
      });

      it("rejects a tag owned by a sibling branch and writes nothing", async () => {
        const sibling = await newTag(fx.otherLeaf.id, "view-sibling");
        const name = uniqueName("Sibling");
        await expect(createMemberView(ownerSession, createMemberViewSchema.parse({ name, definition: withTag(sibling.id) }))).rejects.toBeInstanceOf(
          ValidationError,
        );
        expect(await db.memberView.count({ where: { groupId: fx.leaf.id, name } })).toBe(0);
      });

      it("rejects an unknown tag id on update and leaves the stored definition alone", async () => {
        const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }));
        await expect(
          updateMemberView(ownerSession, updateMemberViewSchema.parse({ viewId: view.id, definition: withTag(999_999_999) })),
        ).rejects.toBeInstanceOf(ValidationError);
        expect((await viewRow(view.id))?.definition).toEqual(emptyDefinition());
      });
    });

    it("rejects an unsupported source or visibility at the schema", () => {
      const base = { name: "X", definition: emptyDefinition() };
      expect(createMemberViewSchema.safeParse({ ...base, source: "attendance" }).success).toBe(false);
      expect(createMemberViewSchema.safeParse({ ...base, visibility: "PRIVATE" }).success).toBe(false);
    });

    it("rolls back the view when the audit insert fails", async () => {
      const name = uniqueName("Rollback");
      auditControl.fail = true;
      await expect(createMemberView(ownerSession, createMemberViewSchema.parse({ name, definition: emptyDefinition() }))).rejects.toThrow("audit failed");
      expect(await db.memberView.count({ where: { groupId: fx.leaf.id, name } })).toBe(0);
    });
  });

  describe("updateMemberView", () => {
    it("lets the owner change the definition and audits before and after", async () => {
      const name = uniqueName();
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name, definition: emptyDefinition() }));

      const updated = await updateMemberView(ownerSession, updateMemberViewSchema.parse({ viewId: view.id, definition: withAge(17) }));
      expect(updated.definition).toEqual(withAge(17));
      expect(updated.name).toBe(name);

      const [entry] = await auditFor("member_view.update", view.id);
      expect(entry.before).toEqual({ name, definition: emptyDefinition() });
      expect(entry.after).toEqual({ name, definition: withAge(17) });
    });

    it("renames, and keeps the definition", async () => {
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: withAge(5) }));
      const newName = uniqueName("Baru");

      const updated = await updateMemberView(ownerSession, { viewId: view.id, name: newName });
      expect(updated.name).toBe(newName);
      expect(updated.definition).toEqual(withAge(5));
    });

    it("allows keeping the view's own name", async () => {
      const name = uniqueName();
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name, definition: emptyDefinition() }));
      await expect(updateMemberView(ownerSession, { viewId: view.id, name: name.toUpperCase(), definition: withAge(1) })).resolves.toBeDefined();
    });

    it("rejects renaming to another view's name", async () => {
      const taken = uniqueName();
      await createMemberView(ownerSession, createMemberViewSchema.parse({ name: taken, definition: emptyDefinition() }));
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }));

      await expect(updateMemberView(ownerSession, { viewId: view.id, name: taken })).rejects.toBeInstanceOf(ValidationError);
    });

    it("denies another group member, even an ADMIN, while the owner is still active", async () => {
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }));

      await expect(updateMemberView(otherAdminSession, { viewId: view.id, definition: withAge(9) })).rejects.toBeInstanceOf(ForbiddenError);
      expect((await viewRow(view.id))?.definition).toEqual(emptyDefinition());
      expect(await auditFor("member_view.update", view.id)).toHaveLength(0);
    });

    it("answers 404 from an ancestor group", async () => {
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }));
      await expect(updateMemberView(branchSession, { viewId: view.id, name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("answers 404 for an unknown or deleted view", async () => {
      await expect(updateMemberView(ownerSession, { viewId: 999_999, name: "x" })).rejects.toBeInstanceOf(NotFoundError);

      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }));
      await deleteMemberView(ownerSession, { viewId: view.id });
      await expect(updateMemberView(ownerSession, { viewId: view.id, name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("requires at least a name or a definition", () => {
      expect(updateMemberViewSchema.safeParse({ viewId: 1 }).success).toBe(false);
    });

    it("rolls back the update when the audit insert fails", async () => {
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }));
      auditControl.fail = true;
      await expect(updateMemberView(ownerSession, { viewId: view.id, definition: withAge(40) })).rejects.toThrow("audit failed");
      expect((await viewRow(view.id))?.definition).toEqual(emptyDefinition());
    });
  });

  describe("deleteMemberView", () => {
    it("lets the owner soft-delete and audits the snapshot", async () => {
      const name = uniqueName();
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name, definition: withAge(3) }));

      await deleteMemberView(ownerSession, { viewId: view.id });

      expect(await viewRow(view.id)).toBeNull();
      const raw = await db.$queryRaw<{ deletedAt: unknown }[]>`SELECT deletedAt FROM MemberView WHERE id = ${view.id}`;
      expect(raw[0].deletedAt).not.toBeNull();
      const [entry] = await auditFor("member_view.delete", view.id);
      expect(entry.before).toMatchObject({ name, source: "member", visibility: "GROUP", definition: withAge(3) });
    });

    it("denies a non-owner in the group and leaves the view", async () => {
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }));
      await expect(deleteMemberView(otherUserSession, { viewId: view.id })).rejects.toBeInstanceOf(ForbiddenError);
      expect(await viewRow(view.id)).not.toBeNull();
    });
  });

  describe("transferMemberView", () => {
    async function orphanedView(reason: "deactivated" | "moved") {
      const prev = await makeUser(`view-mut-prev-${++nameSeq}`, fx.leaf.id, "USER");
      const view = await createMemberView(
        sessionFor(prev.id, "USER", fx.leaf),
        createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }),
      );
      if (reason === "deactivated") await db.user.update({ where: { id: prev.id }, data: { isActive: false } });
      else await db.userGroupRole.update({ where: { userId: prev.id }, data: { groupId: fx.otherLeaf.id } });
      return { view, prev };
    }

    it("lets an ADMIN take over a view whose owner was deactivated, and audits it", async () => {
      const { view, prev } = await orphanedView("deactivated");

      const result = await transferMemberView(otherAdminSession, { viewId: view.id });
      expect(result.ownerId).toBe(otherUserId);
      expect(result.createdById).toBe(prev.id);

      const [entry] = await auditFor("member_view.transfer", view.id);
      expect(entry.meta).toEqual({ fromOwnerId: prev.id, toOwnerId: otherUserId });
    });

    it("lets an ADMIN take over a view whose owner moved to another group, then edit it", async () => {
      const { view } = await orphanedView("moved");
      await transferMemberView(otherAdminSession, { viewId: view.id });
      await expect(updateMemberView(otherAdminSession, { viewId: view.id, name: uniqueName("Diambil") })).resolves.toBeDefined();
    });

    it("denies takeover of a view with an active owner in the group", async () => {
      const view = await createMemberView(ownerSession, createMemberViewSchema.parse({ name: uniqueName(), definition: emptyDefinition() }));
      await expect(transferMemberView(otherAdminSession, { viewId: view.id })).rejects.toBeInstanceOf(ForbiddenError);
      expect((await viewRow(view.id))?.ownerId).toBe(ownerId);
    });

    it("denies a USER taking over an orphaned view", async () => {
      const { view } = await orphanedView("deactivated");
      await expect(transferMemberView(otherUserSession, { viewId: view.id })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("answers 404 from another group", async () => {
      const { view } = await orphanedView("deactivated");
      await expect(transferMemberView(branchSession, { viewId: view.id })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rolls back the takeover when the audit insert fails", async () => {
      const { view, prev } = await orphanedView("deactivated");
      auditControl.fail = true;
      await expect(transferMemberView(otherAdminSession, { viewId: view.id })).rejects.toThrow("audit failed");
      expect((await viewRow(view.id))?.ownerId).toBe(prev.id);
    });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TAG_MAX_PER_GROUP } from "@/lib/constants";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { TagColor } from "@/lib/validation/enums";
import { buildPageFixture, sessionFor, type FixtureGroup, type PageFixture } from "@/lib/test/fixtures";
import { createTag, deleteTag, deleteTagKey, recolorTag, renameTagKey, renameTagValue } from "./mutations";

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
let rootAdmin: ReturnType<typeof sessionFor>;
let branchAdmin: ReturnType<typeof sessionFor>;
let leafAdmin: ReturnType<typeof sessionFor>;
let leafUser: ReturnType<typeof sessionFor>;
let otherLeafAdmin: ReturnType<typeof sessionFor>;
let leafAdminId: number;
let seq = 0;

/** A key name no other test uses, so tests do not collide inside the shared database. */
const uniqueKey = (prefix = "kunci") => `${prefix}-${++seq}`;

async function makeUser(username: string, group: FixtureGroup, role: "OWNER" | "ADMIN" | "USER") {
  const user = await db.user.create({ data: { username, passwordHash: "x", name: username } });
  await db.userGroupRole.create({ data: { userId: user.id, groupId: group.id, role } });
  return sessionFor(user.id, role, group);
}

const make = (groupId: number, key: string, value: string | null = null, color = "blue") =>
  db.tag.create({ data: { groupId, key, value, color, createdById: fx.actorId } });

const simple = (name: string, color: TagColor = "blue") => ({ key: name, value: null, color });
const kv = (key: string, value: string, color: TagColor = "blue") => ({ key, value, color });

async function auditFor(action: string) {
  return db.auditLog.findMany({ where: { action }, orderBy: { id: "desc" } });
}

describe("lib/tag/mutations", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("tag-mutations");
    rootAdmin = await makeUser("tag-mut-root-admin", fx.root, "OWNER");
    branchAdmin = await makeUser("tag-mut-branch-admin", fx.branch, "ADMIN");
    leafAdmin = await makeUser("tag-mut-leaf-admin", fx.leaf, "ADMIN");
    leafUser = await makeUser("tag-mut-leaf-user", fx.leaf, "USER");
    otherLeafAdmin = await makeUser("tag-mut-other-admin", fx.otherLeaf, "ADMIN");
    leafAdminId = Number(leafAdmin.id);
  });

  beforeEach(() => {
    auditControl.fail = false;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("createTag", () => {
    it("creates a simple tag in the caller's own group and audits it", async () => {
      const key = uniqueKey();
      const tag = await createTag(leafAdmin, simple(key, "teal"));

      expect(tag).toMatchObject({ groupId: fx.leaf.id, key, value: null, color: "teal", createdById: leafAdminId });
      const [entry] = await auditFor("tag.create");
      expect(entry).toMatchObject({ actorId: leafAdminId, groupId: fx.leaf.id, entity: "Tag", entityId: tag.id });
      expect(entry.after).toMatchObject({ key, value: null, color: "teal" });
    });

    it("creates a key value, and adds a second value to the same key", async () => {
      const key = uniqueKey();
      await createTag(leafAdmin, kv(key, "tinggi", "red"));
      const second = await createTag(leafAdmin, kv(key, "rendah", "green"));
      expect(second).toMatchObject({ key, value: "rendah", color: "green" });
    });

    it("lets an OWNER create (OWNER is above ADMIN)", async () => {
      const tag = await createTag(rootAdmin, simple(uniqueKey()));
      expect(tag.groupId).toBe(fx.root.id);
    });

    it("rejects a USER with 403 and writes nothing", async () => {
      const key = uniqueKey();
      await expect(createTag(leafUser, simple(key))).rejects.toBeInstanceOf(ForbiddenError);
      expect(await db.tag.count({ where: { key } })).toBe(0);
    });

    it("rejects a simple tag when the same group already has values under that key", async () => {
      const key = uniqueKey();
      await make(fx.leaf.id, key, "tinggi");
      await expect(createTag(leafAdmin, simple(key))).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects a key value when the same group already has that key as a simple tag", async () => {
      const key = uniqueKey();
      await make(fx.leaf.id, key);
      await expect(createTag(leafAdmin, kv(key, "tinggi"))).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects a duplicate value within the same (group, key)", async () => {
      const key = uniqueKey();
      await make(fx.leaf.id, key, "tinggi");
      await expect(createTag(leafAdmin, kv(key, "tinggi"))).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects a duplicate simple tag in the same group", async () => {
      const key = uniqueKey();
      await make(fx.leaf.id, key);
      await expect(createTag(leafAdmin, simple(key))).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects a key an ancestor owns, naming the owner group", async () => {
      const key = uniqueKey();
      await make(fx.branch.id, key, "tinggi");
      const error = await createTag(leafAdmin, kv(key, "mendesak")).catch((e) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain("Branch");
      expect(await db.tag.count({ where: { groupId: fx.leaf.id, key } })).toBe(0);
    });

    it("rejects a simple tag whose name an ancestor owns as a simple tag", async () => {
      const key = uniqueKey();
      await make(fx.root.id, key);
      await expect(createTag(leafAdmin, simple(key))).rejects.toBeInstanceOf(ValidationError);
    });

    it("lets sibling branches reuse a name", async () => {
      const key = uniqueKey();
      await make(fx.otherLeaf.id, key);
      const tag = await createTag(leafAdmin, simple(key));
      expect(tag.groupId).toBe(fx.leaf.id);
    });

    it("allows a name a descendant already owns (known gap, design D2)", async () => {
      const key = uniqueKey();
      await make(fx.leaf.id, key);
      const tag = await createTag(branchAdmin, simple(key));
      expect(tag.groupId).toBe(fx.branch.id);
    });

    it("allows reusing the name of a deleted tag", async () => {
      const key = uniqueKey();
      const old = await make(fx.leaf.id, key);
      await db.tag.update({ where: { id: old.id }, data: { deletedAt: new Date() } });
      const tag = await createTag(leafAdmin, simple(key));
      expect(tag.id).not.toBe(old.id);
    });

    it("rejects creating beyond TAG_MAX_PER_GROUP, counting simple tags and key values together", async () => {
      const row = await db.group.create({
        data: { organizationId: fx.organizationId, parentId: fx.branch.id, depth: 2, name: "Limit Leaf", path: "" },
      });
      const limitGroup = await db.group.update({ where: { id: row.id }, data: { path: `${fx.branch.path}${row.id}/` } });
      const admin = await makeUser("tag-mut-limit-admin", limitGroup, "ADMIN");

      await db.tag.createMany({
        data: Array.from({ length: TAG_MAX_PER_GROUP }, (_, i) => ({
          groupId: limitGroup.id,
          key: `limit-${seq}-${i % 10}`,
          value: i < 10 ? null : `v${i}`,
          color: "blue",
          createdById: fx.actorId,
        })),
      });
      await expect(createTag(admin, simple(uniqueKey("beyond")))).rejects.toBeInstanceOf(ValidationError);

      // Deleted tags do not count.
      await db.tag.updateMany({ where: { groupId: limitGroup.id, value: null }, data: { deletedAt: new Date() } });
      await expect(createTag(admin, simple(uniqueKey("fits")))).resolves.toBeTruthy();
    });

    it("rolls back the tag when the audit write fails", async () => {
      const key = uniqueKey();
      auditControl.fail = true;
      await expect(createTag(leafAdmin, simple(key))).rejects.toThrow("audit failed");
      expect(await db.tag.count({ where: { key } })).toBe(0);
    });
  });

  describe("recolorTag", () => {
    it("saves the new color and audits before/after", async () => {
      const tag = await make(fx.leaf.id, uniqueKey(), null, "blue");
      const updated = await recolorTag(leafAdmin, { tagId: tag.id, color: "red" });

      expect(updated.color).toBe("red");
      const [entry] = (await auditFor("tag.update")).filter((e) => e.entityId === tag.id);
      expect(entry).toMatchObject({ groupId: fx.leaf.id, entity: "Tag" });
      expect(entry.before).toMatchObject([{ id: tag.id, color: "blue" }]);
      expect(entry.after).toMatchObject([{ id: tag.id, color: "red" }]);
    });

    it("rejects a USER (403), an ancestor ADMIN (403) and a descendant ADMIN (403)", async () => {
      const own = await make(fx.leaf.id, uniqueKey());
      await expect(recolorTag(leafUser, { tagId: own.id, color: "red" })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(recolorTag(branchAdmin, { tagId: own.id, color: "red" })).rejects.toBeInstanceOf(ForbiddenError);

      const above = await make(fx.branch.id, uniqueKey());
      await expect(recolorTag(leafAdmin, { tagId: above.id, color: "red" })).rejects.toBeInstanceOf(ForbiddenError);
      expect((await db.tag.findUniqueOrThrow({ where: { id: own.id } })).color).toBe("blue");
    });

    it("returns 404 for a tag in a sibling branch and for a deleted tag", async () => {
      const sibling = await make(fx.otherLeaf.id, uniqueKey());
      await expect(recolorTag(leafAdmin, { tagId: sibling.id, color: "red" })).rejects.toBeInstanceOf(NotFoundError);

      const gone = await make(fx.leaf.id, uniqueKey());
      await db.tag.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
      await expect(recolorTag(leafAdmin, { tagId: gone.id, color: "red" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("does not touch the other values of the same key", async () => {
      const key = uniqueKey();
      const high = await make(fx.leaf.id, key, "tinggi", "red");
      const low = await make(fx.leaf.id, key, "rendah", "green");
      await recolorTag(leafAdmin, { tagId: high.id, color: "amber" });
      expect((await db.tag.findUniqueOrThrow({ where: { id: low.id } })).color).toBe("green");
    });

    it("writes no audit entry when the color is unchanged", async () => {
      const tag = await make(fx.leaf.id, uniqueKey(), null, "blue");
      await recolorTag(leafAdmin, { tagId: tag.id, color: "blue" });
      expect((await auditFor("tag.update")).filter((e) => e.entityId === tag.id)).toHaveLength(0);
    });
  });

  describe("renameTagKey", () => {
    it("renames the key on every value in one update and one audit entry", async () => {
      const key = uniqueKey();
      const rows = await Promise.all(["a", "b", "c"].map((v) => make(fx.leaf.id, key, v)));
      const next = uniqueKey("baru");

      const updated = await renameTagKey(leafAdmin, { tagId: rows[1].id, newKey: next });

      expect(updated.map((r) => r.key)).toEqual([next, next, next]);
      expect(await db.tag.count({ where: { key } })).toBe(0);
      const entries = (await auditFor("tag.update")).filter((e) => e.entityId === rows[0].id);
      expect(entries).toHaveLength(1);
      expect((entries[0].before as unknown[]).length).toBe(3);
      expect((entries[0].after as { key: string }[]).map((r) => r.key)).toEqual([next, next, next]);
    });

    it("renames a simple tag", async () => {
      const tag = await make(fx.leaf.id, uniqueKey());
      const next = uniqueKey("baru");
      const [updated] = await renameTagKey(leafAdmin, { tagId: tag.id, newKey: next });
      expect(updated.key).toBe(next);
    });

    it("leaves a sibling owner's rows with the same key alone", async () => {
      const key = uniqueKey();
      const mine = await make(fx.leaf.id, key);
      const theirs = await make(fx.otherLeaf.id, key);
      await renameTagKey(leafAdmin, { tagId: mine.id, newKey: uniqueKey("baru") });
      expect((await db.tag.findUniqueOrThrow({ where: { id: theirs.id } })).key).toBe(key);
    });

    it("rejects a new key that exists in the same group or on the ancestor chain", async () => {
      const taken = uniqueKey();
      await make(fx.leaf.id, taken);
      const above = uniqueKey();
      await make(fx.branch.id, above, "x");
      const tag = await make(fx.leaf.id, uniqueKey());

      await expect(renameTagKey(leafAdmin, { tagId: tag.id, newKey: taken })).rejects.toBeInstanceOf(ValidationError);
      await expect(renameTagKey(leafAdmin, { tagId: tag.id, newKey: above })).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects 403 for non-owners and 404 for another branch, and is a no-op for the same key", async () => {
      const key = uniqueKey();
      const tag = await make(fx.leaf.id, key);
      await expect(renameTagKey(branchAdmin, { tagId: tag.id, newKey: uniqueKey() })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(renameTagKey(otherLeafAdmin, { tagId: tag.id, newKey: uniqueKey() })).rejects.toBeInstanceOf(NotFoundError);

      const before = (await auditFor("tag.update")).length;
      await renameTagKey(leafAdmin, { tagId: tag.id, newKey: key });
      expect((await auditFor("tag.update")).length).toBe(before);
    });

    it("rolls back every row when the audit write fails", async () => {
      const key = uniqueKey();
      const rows = await Promise.all(["a", "b"].map((v) => make(fx.leaf.id, key, v)));
      auditControl.fail = true;
      await expect(renameTagKey(leafAdmin, { tagId: rows[0].id, newKey: uniqueKey("baru") })).rejects.toThrow();
      expect(await db.tag.count({ where: { key } })).toBe(2);
    });
  });

  describe("renameTagValue", () => {
    it("renames one value, keeping its links, and audits", async () => {
      const key = uniqueKey();
      const tag = await make(fx.leaf.id, key, "tinggi");
      const updated = await renameTagValue(leafAdmin, { tagId: tag.id, newValue: "mendesak" });

      expect(updated).toMatchObject({ id: tag.id, key, value: "mendesak" });
      const [entry] = (await auditFor("tag.update")).filter((e) => e.entityId === tag.id);
      expect(entry.before).toMatchObject([{ value: "tinggi" }]);
      expect(entry.after).toMatchObject([{ value: "mendesak" }]);
    });

    it("rejects a duplicate value within the key, and a simple tag", async () => {
      const key = uniqueKey();
      const a = await make(fx.leaf.id, key, "a");
      await make(fx.leaf.id, key, "b");
      await expect(renameTagValue(leafAdmin, { tagId: a.id, newValue: "b" })).rejects.toBeInstanceOf(ValidationError);

      const plain = await make(fx.leaf.id, uniqueKey());
      await expect(renameTagValue(leafAdmin, { tagId: plain.id, newValue: "x" })).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects a USER (403)", async () => {
      const tag = await make(fx.leaf.id, uniqueKey(), "a");
      await expect(renameTagValue(leafUser, { tagId: tag.id, newValue: "b" })).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("deleteTag / deleteTagKey", () => {
    it("soft-deletes one tag and audits the before state", async () => {
      const key = uniqueKey();
      const keep = await make(fx.leaf.id, key, "a");
      const drop = await make(fx.leaf.id, key, "b");

      await deleteTag(leafAdmin, { tagId: drop.id });

      expect(await db.tag.findFirst({ where: { id: drop.id } })).toBeNull();
      expect(await db.tag.findFirst({ where: { id: keep.id } })).not.toBeNull();
      const [entry] = (await auditFor("tag.delete")).filter((e) => e.entityId === drop.id);
      expect(entry).toMatchObject({ groupId: fx.leaf.id, entity: "Tag" });
      expect(entry.before).toMatchObject([{ id: drop.id, key, value: "b" }]);
    });

    it("deleteTagKey soft-deletes every value of the key in one audit entry", async () => {
      const key = uniqueKey();
      const rows = await Promise.all(["a", "b", "c"].map((v) => make(fx.leaf.id, key, v)));
      const sibling = await make(fx.otherLeaf.id, key, "a");

      const deleted = await deleteTagKey(leafAdmin, { tagId: rows[2].id });

      expect(deleted).toHaveLength(3);
      expect(await db.tag.count({ where: { groupId: fx.leaf.id, key } })).toBe(0);
      expect(await db.tag.findFirst({ where: { id: sibling.id } })).not.toBeNull();
      const entries = (await auditFor("tag.delete")).filter((e) => e.entityId === rows[0].id);
      expect(entries).toHaveLength(1);
      expect((entries[0].before as unknown[]).length).toBe(3);
    });

    it("keeps the link rows, which simply stop being shown", async () => {
      const tag = await make(fx.leaf.id, uniqueKey());
      await db.memberTag.create({ data: { memberId: fx.memberId, tagId: tag.id, createdById: fx.actorId } });
      await deleteTag(leafAdmin, { tagId: tag.id });
      expect(await db.memberTag.count({ where: { tagId: tag.id } })).toBe(1);
    });

    it("rejects 403 for a USER and an ancestor ADMIN, 404 for a deleted tag", async () => {
      const tag = await make(fx.leaf.id, uniqueKey());
      await expect(deleteTag(leafUser, { tagId: tag.id })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deleteTagKey(branchAdmin, { tagId: tag.id })).rejects.toBeInstanceOf(ForbiddenError);

      const above = await make(fx.branch.id, uniqueKey());
      await expect(deleteTag(leafAdmin, { tagId: above.id })).rejects.toBeInstanceOf(ForbiddenError);

      await deleteTag(leafAdmin, { tagId: tag.id });
      await expect(deleteTag(leafAdmin, { tagId: tag.id })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rolls back when the audit write fails", async () => {
      const tag = await make(fx.leaf.id, uniqueKey());
      auditControl.fail = true;
      await expect(deleteTag(leafAdmin, { tagId: tag.id })).rejects.toThrow();
      expect(await db.tag.findFirst({ where: { id: tag.id } })).not.toBeNull();
    });
  });
});

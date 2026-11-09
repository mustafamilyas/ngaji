import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TAG_MAX_PER_ENTITY } from "@/lib/constants";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { buildPageFixture, sessionFor, type FixtureGroup, type PageFixture } from "@/lib/test/fixtures";
import { attachActivityTag, attachMemberTag, bulkTagMembers, detachActivityTag, detachMemberTag } from "./assign";

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
let leafUser: ReturnType<typeof sessionFor>;
let leafUserId: number;
let branchAdmin: ReturnType<typeof sessionFor>;
let otherLeafUser: ReturnType<typeof sessionFor>;
let otherOrgUser: ReturnType<typeof sessionFor>;
let branchActivityId: number;
let otherLeafActivityId: number;
let otherLeafMemberId: number;
let seq = 0;

const uniqueKey = (prefix = "tag") => `${prefix}-${++seq}`;

async function makeUser(username: string, group: FixtureGroup, role: "OWNER" | "ADMIN" | "USER") {
  const user = await db.user.create({ data: { username, passwordHash: "x", name: username } });
  await db.userGroupRole.create({ data: { userId: user.id, groupId: group.id, role } });
  return sessionFor(user.id, role, group);
}

const make = (groupId: number, key: string, value: string | null = null) =>
  db.tag.create({ data: { groupId, key, value, color: "blue", createdById: fx.actorId } });

const memberData = (groupId: number, name: string) => ({
  groupId,
  name,
  birthPlace: "Jakarta",
  birthDate: "2000-01-01",
  sex: "L",
  address: "-",
  phone: "081200000001",
  maritalStatus: "BELUM_MENIKAH",
  workStatus: "BEKERJA",
  joinedAt: "2024-01-01",
  createdById: fx.actorId,
});

const makeMember = (groupId: number) => db.member.create({ data: memberData(groupId, `Anggota ${++seq}`) });

const activityData = (groupId: number, name: string) => ({
  groupId,
  name,
  location: "Aula",
  startTime: "19:00",
  durationMinutes: 60,
  freq: "WEEKLY",
  interval: 1,
  weekdays: [1],
  startsOn: "2024-01-01",
  createdById: fx.actorId,
});

const makeActivity = (groupId: number) => db.activity.create({ data: activityData(groupId, `Kegiatan ${++seq}`) });

const memberTagIds = async (memberId: number) =>
  (await db.memberTag.findMany({ where: { memberId } })).map((l) => l.tagId).sort((a, b) => a - b);
const activityTagIds = async (activityId: number) =>
  (await db.activityTag.findMany({ where: { activityId } })).map((l) => l.tagId).sort((a, b) => a - b);

async function auditFor(action: string, entityId: number) {
  return db.auditLog.findMany({ where: { action, entityId }, orderBy: { id: "desc" } });
}

describe("lib/tag/assign", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("tag-assign");
    leafUser = await makeUser("tag-assign-leaf-user", fx.leaf, "USER");
    leafUserId = Number(leafUser.id);
    branchAdmin = await makeUser("tag-assign-branch-admin", fx.branch, "ADMIN");
    otherLeafUser = await makeUser("tag-assign-other-user", fx.otherLeaf, "USER");

    const otherFx = await buildPageFixture("tag-assign-other-org");
    otherOrgUser = await makeUser("tag-assign-org-user", otherFx.leaf, "USER");

    branchActivityId = (await makeActivity(fx.branch.id)).id;
    otherLeafActivityId = (await makeActivity(fx.otherLeaf.id)).id;
    otherLeafMemberId = (await makeMember(fx.otherLeaf.id)).id;
  });

  beforeEach(() => {
    auditControl.fail = false;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("attachMemberTag", () => {
    it("lets a USER attach an ancestor's tag to a member and audits it on the member's group", async () => {
      const tag = await make(fx.branch.id, uniqueKey());
      const result = await attachMemberTag(leafUser, { memberId: fx.memberId, tagId: tag.id });

      expect(result).toEqual({ changed: true, replacedTagIds: [] });
      expect(await memberTagIds(fx.memberId)).toContain(tag.id);
      const link = await db.memberTag.findUniqueOrThrow({ where: { memberId_tagId: { memberId: fx.memberId, tagId: tag.id } } });
      expect(link.createdById).toBe(leafUserId);
      const [entry] = await auditFor("member.tag", fx.memberId);
      expect(entry).toMatchObject({ actorId: leafUserId, groupId: fx.leaf.id, entity: "Member" });
      expect(entry.meta).toEqual({ tagId: tag.id, memberIds: [fx.memberId], replacedTagIds: [] });
    });

    it("is idempotent: a tag already on the member changes nothing and writes no audit entry", async () => {
      const member = await makeMember(fx.leaf.id);
      const tag = await make(fx.leaf.id, uniqueKey());
      await attachMemberTag(leafUser, { memberId: member.id, tagId: tag.id });
      const again = await attachMemberTag(leafUser, { memberId: member.id, tagId: tag.id });

      expect(again).toEqual({ changed: false, replacedTagIds: [] });
      expect(await auditFor("member.tag", member.id)).toHaveLength(1);
    });

    it("replaces another value of the same (owner, key) and records it as replaced", async () => {
      const member = await makeMember(fx.leaf.id);
      const key = uniqueKey();
      const high = await make(fx.leaf.id, key, "tinggi");
      const low = await make(fx.leaf.id, key, "rendah");
      await attachMemberTag(leafUser, { memberId: member.id, tagId: high.id });

      const result = await attachMemberTag(leafUser, { memberId: member.id, tagId: low.id });

      expect(result).toEqual({ changed: true, replacedTagIds: [high.id] });
      expect(await memberTagIds(member.id)).toEqual([low.id]);
      const [entry] = await auditFor("member.tag", member.id);
      expect(entry.meta).toEqual({ tagId: low.id, memberIds: [member.id], replacedTagIds: [high.id] });
    });

    it("does not replace simple tags or a same-named key from another owner", async () => {
      const member = await makeMember(fx.leaf.id);
      const key = uniqueKey();
      const above = await make(fx.branch.id, key, "tinggi");
      const own = await make(fx.leaf.id, key, "rendah");
      const plain = await make(fx.leaf.id, uniqueKey());
      for (const tag of [above, plain, own]) await attachMemberTag(leafUser, { memberId: member.id, tagId: tag.id });

      expect(await memberTagIds(member.id)).toEqual([above.id, own.id, plain.id].sort((a, b) => a - b));
    });

    it("rejects with 403 a visible tag the user cannot use (owned by a descendant)", async () => {
      const tag = await make(fx.leaf.id, uniqueKey());
      await expect(attachMemberTag(branchAdmin, { memberId: fx.memberId, tagId: tag.id })).rejects.toBeInstanceOf(ForbiddenError);
      expect(await memberTagIds(fx.memberId)).not.toContain(tag.id);
    });

    it("returns 404 when a tag's branch tries to tag a member of a sibling branch", async () => {
      // "Fits the tag group's subtree" cannot fail on its own: usable (owner is the user's ancestor-or-self) plus
      // in-scope already implies it, so a sibling's member surfaces as not found (tasks 8.1).
      const k1 = await make(fx.leaf.id, uniqueKey());
      await expect(attachMemberTag(leafUser, { memberId: otherLeafMemberId, tagId: k1.id })).rejects.toBeInstanceOf(NotFoundError);
      expect(await memberTagIds(otherLeafMemberId)).toEqual([]);
    });

    it("returns 404 for a member out of scope, another organization, or deleted, and for an invisible tag", async () => {
      const tag = await make(fx.branch.id, uniqueKey());
      await expect(attachMemberTag(leafUser, { memberId: otherLeafMemberId, tagId: tag.id })).rejects.toBeInstanceOf(NotFoundError);
      await expect(attachMemberTag(otherOrgUser, { memberId: fx.memberId, tagId: tag.id })).rejects.toBeInstanceOf(NotFoundError);

      const gone = await makeMember(fx.leaf.id);
      await db.member.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
      await expect(attachMemberTag(leafUser, { memberId: gone.id, tagId: tag.id })).rejects.toBeInstanceOf(NotFoundError);

      const sibling = await make(fx.otherLeaf.id, uniqueKey());
      await expect(attachMemberTag(leafUser, { memberId: fx.memberId, tagId: sibling.id })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("tags a member of any status", async () => {
      const member = await db.member.create({ data: { ...memberData(fx.leaf.id, "Keluar"), status: "KELUAR" } });
      const tag = await make(fx.leaf.id, uniqueKey());
      await expect(attachMemberTag(leafUser, { memberId: member.id, tagId: tag.id })).resolves.toMatchObject({ changed: true });
    });

    it("rejects the TAG_MAX_PER_ENTITY + 1th tag, ignoring links to deleted tags, and allows a replacement at the cap", async () => {
      const member = await makeMember(fx.leaf.id);
      const tags = await Promise.all(Array.from({ length: TAG_MAX_PER_ENTITY }, (_, i) => make(fx.leaf.id, uniqueKey(`cap${i}`))));
      await db.memberTag.createMany({ data: tags.map((t) => ({ memberId: member.id, tagId: t.id, createdById: fx.actorId })) });
      const extra = await make(fx.leaf.id, uniqueKey("extra"));

      await expect(attachMemberTag(leafUser, { memberId: member.id, tagId: extra.id })).rejects.toBeInstanceOf(ValidationError);
      expect(await memberTagIds(member.id)).toHaveLength(TAG_MAX_PER_ENTITY);

      await db.tag.update({ where: { id: tags[0].id }, data: { deletedAt: new Date() } });
      await expect(attachMemberTag(leafUser, { memberId: member.id, tagId: extra.id })).resolves.toMatchObject({ changed: true });

      // At the cap again; swapping one value of a key for another stays within it.
      const key = uniqueKey("swap");
      const a = await make(fx.leaf.id, key, "a");
      const b = await make(fx.leaf.id, key, "b");
      await db.memberTag.delete({ where: { memberId_tagId: { memberId: member.id, tagId: extra.id } } });
      await attachMemberTag(leafUser, { memberId: member.id, tagId: a.id });
      await expect(attachMemberTag(leafUser, { memberId: member.id, tagId: b.id })).resolves.toMatchObject({ replacedTagIds: [a.id] });
    });

    it("rolls back the link and the replacement when the audit write fails", async () => {
      const member = await makeMember(fx.leaf.id);
      const key = uniqueKey();
      const high = await make(fx.leaf.id, key, "tinggi");
      const low = await make(fx.leaf.id, key, "rendah");
      await attachMemberTag(leafUser, { memberId: member.id, tagId: high.id });

      auditControl.fail = true;
      await expect(attachMemberTag(leafUser, { memberId: member.id, tagId: low.id })).rejects.toThrow("audit failed");
      expect(await memberTagIds(member.id)).toEqual([high.id]);
    });
  });

  describe("detachMemberTag", () => {
    it("removes the link and writes one member.untag entry", async () => {
      const member = await makeMember(fx.leaf.id);
      const tag = await make(fx.branch.id, uniqueKey());
      await attachMemberTag(leafUser, { memberId: member.id, tagId: tag.id });

      const result = await detachMemberTag(leafUser, { memberId: member.id, tagId: tag.id });

      expect(result).toEqual({ changed: true });
      expect(await memberTagIds(member.id)).toEqual([]);
      const [entry] = await auditFor("member.untag", member.id);
      expect(entry).toMatchObject({ groupId: fx.leaf.id });
      expect(entry.meta).toEqual({ tagId: tag.id, memberIds: [member.id], replacedTagIds: [] });
    });

    it("is a no-op without audit when the tag is not on the member", async () => {
      const member = await makeMember(fx.leaf.id);
      const tag = await make(fx.leaf.id, uniqueKey());
      expect(await detachMemberTag(leafUser, { memberId: member.id, tagId: tag.id })).toEqual({ changed: false });
      expect(await auditFor("member.untag", member.id)).toHaveLength(0);
    });

    it("rejects with 403 a tag the user cannot use, and 404 for an out-of-scope member", async () => {
      const member = await makeMember(fx.leaf.id);
      const tag = await make(fx.leaf.id, uniqueKey());
      await db.memberTag.create({ data: { memberId: member.id, tagId: tag.id, createdById: fx.actorId } });

      await expect(detachMemberTag(branchAdmin, { memberId: member.id, tagId: tag.id })).rejects.toBeInstanceOf(ForbiddenError);
      expect(await memberTagIds(member.id)).toEqual([tag.id]);
      await expect(detachMemberTag(leafUser, { memberId: otherLeafMemberId, tagId: tag.id })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("attachActivityTag / detachActivityTag", () => {
    it("lets a kelompok attach its own tag to an inherited activity and audits on the tag's group", async () => {
      const tag = await make(fx.leaf.id, uniqueKey());
      const result = await attachActivityTag(leafUser, { activityId: branchActivityId, tagId: tag.id });

      expect(result).toEqual({ changed: true, replacedTagIds: [] });
      expect(await activityTagIds(branchActivityId)).toContain(tag.id);
      const [entry] = await auditFor("activity.tag", branchActivityId);
      expect(entry).toMatchObject({ groupId: fx.leaf.id, entity: "Activity" });
      expect(entry.meta).toEqual({ tagId: tag.id, activityIds: [branchActivityId], replacedTagIds: [] });
    });

    it("needs no edit right: a plain USER may tag an activity of an ancestor", async () => {
      const tag = await make(fx.branch.id, uniqueKey());
      await expect(attachActivityTag(leafUser, { activityId: branchActivityId, tagId: tag.id })).resolves.toMatchObject({ changed: true });
    });

    it("keeps sibling branches' same-key values apart (exclusivity is per owner)", async () => {
      const key = uniqueKey();
      const k1 = await make(fx.leaf.id, key, "tinggi");
      const k2 = await make(fx.otherLeaf.id, key, "rendah");
      await attachActivityTag(leafUser, { activityId: branchActivityId, tagId: k1.id });
      await attachActivityTag(otherLeafUser, { activityId: branchActivityId, tagId: k2.id });
      expect(await activityTagIds(branchActivityId)).toEqual(expect.arrayContaining([k1.id, k2.id]));
    });

    it("replaces another value of the same owner key", async () => {
      const activity = await makeActivity(fx.branch.id);
      const key = uniqueKey();
      const high = await make(fx.leaf.id, key, "tinggi");
      const low = await make(fx.leaf.id, key, "rendah");
      await attachActivityTag(leafUser, { activityId: activity.id, tagId: high.id });
      const result = await attachActivityTag(leafUser, { activityId: activity.id, tagId: low.id });
      expect(result.replacedTagIds).toEqual([high.id]);
      expect(await activityTagIds(activity.id)).toEqual([low.id]);
    });

    it("is idempotent without audit", async () => {
      const activity = await makeActivity(fx.branch.id);
      const tag = await make(fx.leaf.id, uniqueKey());
      await attachActivityTag(leafUser, { activityId: activity.id, tagId: tag.id });
      expect(await attachActivityTag(leafUser, { activityId: activity.id, tagId: tag.id })).toEqual({ changed: false, replacedTagIds: [] });
      expect(await auditFor("activity.tag", activity.id)).toHaveLength(1);
    });

    it("returns 404 for an activity the user cannot see, 403 for a tag they cannot use", async () => {
      const tag = await make(fx.leaf.id, uniqueKey());
      await expect(attachActivityTag(leafUser, { activityId: otherLeafActivityId, tagId: tag.id })).rejects.toBeInstanceOf(NotFoundError);

      const below = await make(fx.leaf.id, uniqueKey());
      await expect(attachActivityTag(branchAdmin, { activityId: branchActivityId, tagId: below.id })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("rejects past TAG_MAX_PER_ENTITY", async () => {
      const activity = await makeActivity(fx.branch.id);
      const tags = await Promise.all(Array.from({ length: TAG_MAX_PER_ENTITY }, (_, i) => make(fx.leaf.id, uniqueKey(`acap${i}`))));
      await db.activityTag.createMany({ data: tags.map((t) => ({ activityId: activity.id, tagId: t.id, createdById: fx.actorId })) });
      const extra = await make(fx.leaf.id, uniqueKey("extra"));
      await expect(attachActivityTag(leafUser, { activityId: activity.id, tagId: extra.id })).rejects.toBeInstanceOf(ValidationError);
    });

    it("detaches with one activity.untag entry, no-ops when absent, 403 when unusable", async () => {
      const activity = await makeActivity(fx.branch.id);
      const tag = await make(fx.leaf.id, uniqueKey());
      await attachActivityTag(leafUser, { activityId: activity.id, tagId: tag.id });

      expect(await detachActivityTag(leafUser, { activityId: activity.id, tagId: tag.id })).toEqual({ changed: true });
      expect(await activityTagIds(activity.id)).toEqual([]);
      const [entry] = await auditFor("activity.untag", activity.id);
      expect(entry.meta).toEqual({ tagId: tag.id, activityIds: [activity.id], replacedTagIds: [] });

      expect(await detachActivityTag(leafUser, { activityId: activity.id, tagId: tag.id })).toEqual({ changed: false });
      expect(await auditFor("activity.untag", activity.id)).toHaveLength(1);

      await expect(detachActivityTag(branchAdmin, { activityId: activity.id, tagId: tag.id })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("rolls back when the audit write fails", async () => {
      const activity = await makeActivity(fx.branch.id);
      const tag = await make(fx.leaf.id, uniqueKey());
      auditControl.fail = true;
      await expect(attachActivityTag(leafUser, { activityId: activity.id, tagId: tag.id })).rejects.toThrow("audit failed");
      expect(await activityTagIds(activity.id)).toEqual([]);
    });
  });

  describe("bulkTagMembers", () => {
    const addTo = (memberIds: number[], tagId: number, session = leafUser) =>
      bulkTagMembers(session, { memberIds, tagId, op: "add" });

    it("adds a tag to every member, reports the count and writes one audit entry on the tag owner's group", async () => {
      const members = await Promise.all([makeMember(fx.leaf.id), makeMember(fx.leaf.id), makeMember(fx.leaf.id)]);
      const ids = members.map((m) => m.id);
      const tag = await make(fx.branch.id, uniqueKey());

      expect(await addTo(ids, tag.id)).toEqual({ changed: 3 });

      for (const id of ids) expect(await memberTagIds(id)).toEqual([tag.id]);
      const entries = await db.auditLog.findMany({ where: { action: "member.tag", groupId: fx.branch.id, entityId: null } });
      const entry = entries.find((e) => (e.meta as { tagId: number }).tagId === tag.id);
      expect(entry?.meta).toEqual({ tagId: tag.id, memberIds: ids, replacedLinks: [] });
      expect(entry).toMatchObject({ actorId: leafUserId, entity: "Member" });
    });

    it("replaces another value of the key per member and lists the replaced links", async () => {
      const key = uniqueKey();
      const high = await make(fx.leaf.id, key, "tinggi");
      const low = await make(fx.leaf.id, key, "rendah");
      const [a, b, c] = await Promise.all([makeMember(fx.leaf.id), makeMember(fx.leaf.id), makeMember(fx.leaf.id)]);
      await attachMemberTag(leafUser, { memberId: a.id, tagId: high.id });
      await attachMemberTag(leafUser, { memberId: c.id, tagId: high.id });

      expect(await addTo([a.id, b.id, c.id], low.id)).toEqual({ changed: 3 });

      for (const m of [a, b, c]) expect(await memberTagIds(m.id)).toEqual([low.id]);
      const entry = (await db.auditLog.findMany({ where: { action: "member.tag", entityId: null }, orderBy: { id: "desc" } }))[0];
      expect(entry.meta).toEqual({
        tagId: low.id,
        memberIds: [a.id, b.id, c.id],
        replacedLinks: [
          { memberId: a.id, tagId: high.id },
          { memberId: c.id, tagId: high.id },
        ],
      });
    });

    it("skips members that already have the tag and writes no audit when nothing changes", async () => {
      const [a, b] = await Promise.all([makeMember(fx.leaf.id), makeMember(fx.leaf.id)]);
      const tag = await make(fx.leaf.id, uniqueKey());
      await attachMemberTag(leafUser, { memberId: a.id, tagId: tag.id });

      expect(await addTo([a.id, b.id], tag.id)).toEqual({ changed: 1 });
      const before = await db.auditLog.count({ where: { action: "member.tag", entityId: null } });
      expect(await addTo([a.id, b.id], tag.id)).toEqual({ changed: 0 });
      expect(await db.auditLog.count({ where: { action: "member.tag", entityId: null } })).toBe(before);
    });

    it("rejects the whole batch when one id is out of scope, and writes nothing", async () => {
      const mine = await makeMember(fx.leaf.id);
      const tag = await make(fx.branch.id, uniqueKey());

      await expect(addTo([mine.id, otherLeafMemberId], tag.id)).rejects.toBeInstanceOf(NotFoundError);
      expect(await memberTagIds(mine.id)).toEqual([]);
    });

    it("rejects with 403 a tag the user cannot use, and 404 an invisible tag", async () => {
      const mine = await makeMember(fx.leaf.id);
      const below = await make(fx.leaf.id, uniqueKey());
      await expect(addTo([mine.id], below.id, branchAdmin)).rejects.toBeInstanceOf(ForbiddenError);

      const sibling = await make(fx.otherLeaf.id, uniqueKey());
      await expect(addTo([mine.id], sibling.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rejects the whole batch when any member would exceed TAG_MAX_PER_ENTITY", async () => {
      const [full, roomy] = await Promise.all([makeMember(fx.leaf.id), makeMember(fx.leaf.id)]);
      const filler = await Promise.all(Array.from({ length: TAG_MAX_PER_ENTITY }, (_, i) => make(fx.leaf.id, uniqueKey(`bcap${i}`))));
      await db.memberTag.createMany({ data: filler.map((t) => ({ memberId: full.id, tagId: t.id, createdById: fx.actorId })) });
      const tag = await make(fx.leaf.id, uniqueKey());

      await expect(addTo([roomy.id, full.id], tag.id)).rejects.toBeInstanceOf(ValidationError);
      expect(await memberTagIds(roomy.id)).toEqual([]);
    });

    it("removes the tag from the members that have it and audits member.untag once", async () => {
      const [a, b, c] = await Promise.all([makeMember(fx.leaf.id), makeMember(fx.leaf.id), makeMember(fx.leaf.id)]);
      const tag = await make(fx.leaf.id, uniqueKey());
      await addTo([a.id, c.id], tag.id);

      const result = await bulkTagMembers(leafUser, { memberIds: [a.id, b.id, c.id], tagId: tag.id, op: "remove" });

      expect(result).toEqual({ changed: 2 });
      for (const m of [a, b, c]) expect(await memberTagIds(m.id)).toEqual([]);
      const entries = await db.auditLog.findMany({ where: { action: "member.untag", entityId: null } });
      const entry = entries.find((e) => (e.meta as { tagId: number }).tagId === tag.id);
      expect(entry?.meta).toEqual({ tagId: tag.id, memberIds: [a.id, c.id], replacedLinks: [] });
    });

    it("rolls back every link when the audit write fails", async () => {
      const [a, b] = await Promise.all([makeMember(fx.leaf.id), makeMember(fx.leaf.id)]);
      const tag = await make(fx.leaf.id, uniqueKey());
      auditControl.fail = true;
      await expect(addTo([a.id, b.id], tag.id)).rejects.toThrow("audit failed");
      expect(await memberTagIds(a.id)).toEqual([]);
      expect(await memberTagIds(b.id)).toEqual([]);
    });
  });
});

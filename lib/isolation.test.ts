import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { audit } from "@/lib/audit";
import { listActivityOccurrences } from "@/lib/activity/list";
import { deleteActivity } from "@/lib/activity/mutations";
import { overrideOccurrence } from "@/lib/activity/occurrence-mutations";
import { saveAttendance } from "@/lib/attendance/save";
import { setMemberAttendance } from "@/lib/attendance/set";
import { listAuditLog } from "@/lib/audit-log/queries";
import { addDays, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getLevels, listLeafGroupsInScope, renameLevel } from "@/lib/group/levels";
import { createGroup, deleteGroup, renameGroup } from "@/lib/group/mutations";
import { createMember, deleteMember } from "@/lib/member/mutations";
import { listMembers } from "@/lib/member/queries";
import { deleteMemberView } from "@/lib/member-view/mutations";
import { listMemberViews } from "@/lib/member-view/list";
import { getOrganization } from "@/lib/organization";
import { resolveTag, resolveVisibleTags } from "@/lib/resolve";
import { deleteSurvey } from "@/lib/survey/mutations";
import { listSurveys } from "@/lib/survey/list";
import { saveResponse } from "@/lib/survey/responses";
import { surveyStatistics } from "@/lib/survey/stats";
import { attachActivityTag, attachMemberTag, bulkTagMembers, detachMemberTag } from "@/lib/tag/assign";
import { visibleTagWhere } from "@/lib/tag/access";
import { createTag, deleteTag, deleteTagKey, recolorTag, renameTagKey } from "@/lib/tag/mutations";
import { buildOrgFixture, type OrgFixture } from "@/lib/test/fixtures";
import { createUser, resetUserPassword, setUserActive, updateUserRole } from "@/lib/user/mutations";
import { listUsers, listUsersInScope } from "@/lib/user/queries";

// Org A's root OWNER versus org B's data (multi-organization spec, "Data
// isolation between organizations"). Every id below belongs to org B and is
// submitted the way a forged client request would.
describe("cross-organization isolation", () => {
  let A: OrgFixture;
  let B: OrgFixture;
  let bSurveyId: number;
  let bViewId: number;
  let bOccurrenceDate: string;
  let bExtraOwnerIds: number[];
  let bTagId: number;
  let bValueTagId: number;
  let aTagId: number;

  beforeAll(async () => {
    A = await buildOrgFixture("iso-a");
    B = await buildOrgFixture("iso-b", { timezone: "Asia/Jayapura" });

    // Org B: a second and third OWNER, a survey, a member view, an occurrence with attendance, an audit entry.
    bExtraOwnerIds = [];
    for (const n of [1, 2]) {
      const user = await db.user.create({ data: { username: `iso-b-owner-${n}`, passwordHash: "x", name: `B Owner ${n}` } });
      await db.userGroupRole.create({ data: { userId: user.id, groupId: B.root.id, role: "OWNER" } });
      bExtraOwnerIds.push(user.id);
    }
    const survey = await db.survey.create({
      data: { groupId: B.root.id, title: "Survei B", createdById: B.actorId },
    });
    bSurveyId = survey.id;

    const view = await db.memberView.create({
      data: {
        groupId: B.root.id,
        ownerId: B.actorId,
        createdById: B.actorId,
        name: "Tampilan B",
        definition: {},
      },
    });
    bViewId = view.id;

    bOccurrenceDate = today("Asia/Jakarta");
    const occurrence = await db.activityOccurrence.create({
      data: { activityId: B.activityId, date: bOccurrenceDate, status: "SCHEDULED" },
    });
    await db.attendance.create({
      data: { occurrenceId: occurrence.id, memberId: B.memberId, status: "HADIR", recordedById: B.actorId },
    });

    // Org B's tags, linked to B's member and activity; org A has a tag with the same key.
    const bTag = await db.tag.create({ data: { groupId: B.root.id, key: "fokus", color: "red", createdById: B.actorId } });
    const bValueTag = await db.tag.create({
      data: { groupId: B.root.id, key: "prioritas", value: "tinggi", color: "blue", createdById: B.actorId },
    });
    bTagId = bTag.id;
    bValueTagId = bValueTag.id;
    await db.memberTag.create({ data: { memberId: B.memberId, tagId: bTag.id, createdById: B.actorId } });
    await db.activityTag.create({ data: { activityId: B.activityId, tagId: bTag.id, createdById: B.actorId } });
    aTagId = (await db.tag.create({ data: { groupId: A.root.id, key: "fokus", color: "teal", createdById: A.actorId } })).id;

    await db.$transaction((tx) =>
      audit(tx, {
        actorId: B.actorId,
        action: "member.update",
        entity: "Member",
        entityId: B.memberId,
        groupId: B.leaf.id,
        after: { name: "Anggota B" },
      }),
    );
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function auditCountFor(entity: string, ids: number[]) {
    return db.auditLog.count({ where: { entity, entityId: { in: ids } } });
  }

  describe("organization context", () => {
    it("shows each user their own organization's name and timezone", async () => {
      expect(await getOrganization({ user: A.owner })).toEqual({ name: A.organizationName, timeZone: "Asia/Jakarta" });
      expect(await getOrganization({ user: B.owner })).toEqual({ name: B.organizationName, timeZone: "Asia/Jayapura" });
    });
  });

  describe("level", () => {
    it("lists only the caller's own organization's levels", async () => {
      const levels = await getLevels(A.organizationId);
      expect(levels.every((l) => l.organizationId === A.organizationId)).toBe(true);
    });

    it("renames only the caller's own organization's level", async () => {
      await renameLevel(A.owner, { depth: 1, name: "Cabang A" });
      const bLevels = await getLevels(B.organizationId);
      expect(bLevels.map((l) => l.name)).toEqual(B.levelNames);
    });

    it("counts only the caller's own organization's leaf groups", async () => {
      const leaves = await listLeafGroupsInScope(A.owner);
      const ids = leaves.map((g) => g.id);
      expect(ids).toContain(A.leaf.id);
      expect(ids).not.toContain(B.leaf.id);
      expect(ids).not.toContain(B.otherLeaf.id);
    });
  });

  describe("group", () => {
    it("404s when creating, renaming or deleting under another organization's group", async () => {
      await expect(createGroup(A.owner, { parentId: B.root.id, name: "Bocor" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(renameGroup(A.owner, { groupId: B.branch.id, name: "Bocor" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(deleteGroup(A.owner, B.otherLeaf.id)).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.group.findUnique({ where: { id: B.branch.id } })).toMatchObject({ name: "Branch" });
    });
  });

  describe("member", () => {
    it("404s on delete and create against another organization's member or group, writing nothing", async () => {
      const before = await auditCountFor("Member", [B.memberId]);
      await expect(deleteMember(A.owner, B.memberId)).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        createMember(A.owner, {
          groupId: B.leaf.id,
          name: "Penyusup",
          birthPlace: "X",
          birthDate: "2000-01-01",
          sex: "L",
          address: "-",
          phone: "0800",
          maritalStatus: "BELUM_MENIKAH",
          workStatus: "BEKERJA",
          status: "AKTIF",
          joinedAt: "2024-01-01",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(await auditCountFor("Member", [B.memberId])).toBe(before);
      expect(await db.member.count({ where: { groupId: B.leaf.id, name: "Penyusup" } })).toBe(0);
    });

    it("lists no member of another organization", async () => {
      const { members } = await listMembers(A.owner);
      expect(members.some((m) => m.id === B.memberId)).toBe(false);
      expect(members.some((m) => m.id === A.memberId)).toBe(true);
    });
  });

  describe("activity and occurrence", () => {
    it("404s when deleting another organization's activity, with no audit entry", async () => {
      const before = await auditCountFor("Activity", [B.activityId]);
      await expect(deleteActivity(A.owner, B.activityId)).rejects.toBeInstanceOf(NotFoundError);
      expect(await auditCountFor("Activity", [B.activityId])).toBe(before);
      expect(await db.activity.findUnique({ where: { id: B.activityId } })).not.toBeNull();
    });

    it("404s when overriding another organization's occurrence", async () => {
      await expect(
        overrideOccurrence(A.owner, { activityId: B.activityId, date: bOccurrenceDate, status: "CANCELLED" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      const row = await db.activityOccurrence.findFirstOrThrow({ where: { activityId: B.activityId, date: bOccurrenceDate } });
      expect(row.status).toBe("SCHEDULED");
    });

    it("lists no activity of another organization", async () => {
      const from = addDays(today("Asia/Jakarta"), -7);
      const to = addDays(today("Asia/Jakarta"), 7);
      const { entries } = await listActivityOccurrences(A.owner, { from, to });
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e) => e.activityId !== B.activityId)).toBe(true);
    });
  });

  describe("attendance", () => {
    it("404s when saving attendance for another organization's activity or group", async () => {
      await expect(
        saveAttendance(A.owner, { activityId: B.activityId, groupId: B.leaf.id, date: bOccurrenceDate, entries: [] }),
      ).rejects.toBeInstanceOf(NotFoundError);
      // Own activity, but the leaf group is org B's.
      await expect(
        saveAttendance(A.owner, { activityId: A.activityId, groupId: B.leaf.id, date: bOccurrenceDate, entries: [] }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("404s when setting attendance for another organization's member, leaving B's row untouched", async () => {
      await expect(
        setMemberAttendance(A.owner, { activityId: A.activityId, date: today("Asia/Jakarta"), memberId: B.memberId, status: "HADIR" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        setMemberAttendance(A.owner, { activityId: B.activityId, date: bOccurrenceDate, memberId: B.memberId, status: null }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.attendance.count({ where: { memberId: B.memberId } })).toBe(1);
    });
  });

  describe("survey", () => {
    it("404s on response save, survey delete and statistics for another organization's survey", async () => {
      await expect(saveResponse(A.owner, { surveyId: bSurveyId, memberId: B.memberId, answers: [] })).rejects.toBeInstanceOf(NotFoundError);
      // Own survey, but the respondent is org B's member.
      const own = await db.survey.create({ data: { groupId: A.root.id, title: "Survei A", createdById: A.actorId } });
      await expect(saveResponse(A.owner, { surveyId: own.id, memberId: B.memberId, answers: [] })).rejects.toBeInstanceOf(NotFoundError);
      await expect(deleteSurvey(A.owner, bSurveyId)).rejects.toBeInstanceOf(NotFoundError);
      await expect(surveyStatistics(A.owner, bSurveyId)).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.survey.findUnique({ where: { id: bSurveyId } })).toMatchObject({ deletedAt: null });
    });

    it("lists no survey of another organization", async () => {
      const { surveys } = await listSurveys(A.owner);
      expect(surveys.some((s) => s.id === bSurveyId)).toBe(false);
    });
  });

  describe("member view", () => {
    it("404s when deleting another organization's view, and lists none", async () => {
      await expect(deleteMemberView(A.owner, { viewId: bViewId })).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.memberView.findUnique({ where: { id: bViewId } })).toMatchObject({ deletedAt: null });

      const { views } = await listMemberViews(A.owner);
      expect(views.some((v) => v.id === bViewId)).toBe(false);
    });
  });

  describe("user", () => {
    it("404s on role change, deactivation, password reset and creation under another organization", async () => {
      const target = bExtraOwnerIds[0];
      await expect(updateUserRole(A.owner, { userId: target, role: "USER" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(setUserActive(A.owner, { userId: target, isActive: false })).rejects.toBeInstanceOf(NotFoundError);
      await expect(resetUserPassword(A.owner, { userId: target })).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        createUser(A.owner, { groupId: B.root.id, username: "iso-intruder", name: "Penyusup", role: "OWNER" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.user.findUnique({ where: { id: target } })).toMatchObject({ isActive: true });
      expect(await db.user.count({ where: { username: "iso-intruder" } })).toBe(0);
    });

    it("lists no user of another organization", async () => {
      const inScope = await listUsersInScope(A.owner);
      expect(inScope.some((r) => r.user.id === B.actorId)).toBe(false);
      const { roles } = await listUsers(A.owner);
      expect(roles.some((r) => r.user.id === B.actorId || bExtraOwnerIds.includes(r.user.id))).toBe(false);
    });

    it("rejects a username that exists in another organization with the same message as within one organization", async () => {
      const takenInA = `iso-a-actor`; // org A's OWNER, created by buildOrgFixture("iso-a")
      const usersBefore = await db.user.count();
      const auditBefore = await db.auditLog.count({ where: { action: "user.create" } });

      const crossOrg = await createUser(B.owner, { groupId: B.root.id, username: takenInA, name: "Salinan", role: "USER" }).catch((e) => e);

      await createUser(B.owner, { groupId: B.root.id, username: "iso-b-same-org", name: "Pertama", role: "USER" });
      const sameOrg = await createUser(B.owner, { groupId: B.root.id, username: "iso-b-same-org", name: "Kedua", role: "USER" }).catch((e) => e);

      expect(crossOrg).toBeInstanceOf(ValidationError);
      expect(sameOrg).toBeInstanceOf(ValidationError);
      expect(crossOrg.message).toBe(`Username "${takenInA}" sudah dipakai`);
      expect(sameOrg.message).toBe(`Username "iso-b-same-org" sudah dipakai`);

      // Only the one legitimate creation happened: no user and no audit entry for the rejected ones.
      expect(await db.user.count()).toBe(usersBefore + 1);
      expect(await db.auditLog.count({ where: { action: "user.create" } })).toBe(auditBefore + 1);
      expect(await db.user.count({ where: { username: takenInA } })).toBe(1);
    });

    it("keeps last-owner protection per organization: org A's only OWNER cannot deactivate themself", async () => {
      // Org B has three active OWNERs; that must not count for org A.
      await expect(setUserActive(A.owner, { userId: A.actorId, isActive: false })).rejects.toThrow();
      expect(await db.user.findUnique({ where: { id: A.actorId } })).toMatchObject({ isActive: true });
    });
  });

  describe("tag", () => {
    it("404s on resolving another organization's tag and drops it from a filter list", async () => {
      await expect(resolveTag(A.owner, bTagId)).rejects.toBeInstanceOf(NotFoundError);
      const visible = await resolveVisibleTags(A.owner, [bTagId, bValueTagId, aTagId]);
      expect(visible.map((t) => t.id)).toEqual([aTagId]);
    });

    it("never selects another organization's tags through the visibility filter", async () => {
      const tags = await db.tag.findMany({ where: visibleTagWhere(A.owner) });
      expect(tags.some((t) => t.groupId === B.root.id)).toBe(false);
      expect(tags.some((t) => t.id === aTagId)).toBe(true);
    });

    it("404s on recolor, rename and delete of another organization's tag, writing nothing", async () => {
      const before = await auditCountFor("Tag", [bTagId, bValueTagId]);
      await expect(recolorTag(A.owner, { tagId: bTagId, color: "green" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(renameTagKey(A.owner, { tagId: bTagId, newKey: "bocor" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(deleteTag(A.owner, { tagId: bTagId })).rejects.toBeInstanceOf(NotFoundError);
      await expect(deleteTagKey(A.owner, { tagId: bValueTagId })).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.tag.findUnique({ where: { id: bTagId } })).toMatchObject({ key: "fokus", color: "red" });
      expect(await auditCountFor("Tag", [bTagId, bValueTagId])).toBe(before);
    });

    it("does not treat another organization's key as taken", async () => {
      const tag = await createTag(A.owner, { key: "prioritas", value: "tinggi", color: "blue" });
      expect(tag.groupId).toBe(A.root.id);
    });

    it("404s when attaching or detaching across organizations, in either direction, and for bulk", async () => {
      await expect(attachMemberTag(A.owner, { memberId: A.memberId, tagId: bTagId })).rejects.toBeInstanceOf(NotFoundError);
      await expect(attachMemberTag(A.owner, { memberId: B.memberId, tagId: aTagId })).rejects.toBeInstanceOf(NotFoundError);
      await expect(detachMemberTag(A.owner, { memberId: B.memberId, tagId: bTagId })).rejects.toBeInstanceOf(NotFoundError);
      await expect(attachActivityTag(A.owner, { activityId: B.activityId, tagId: aTagId })).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        bulkTagMembers(A.owner, { memberIds: [A.memberId, B.memberId], tagId: aTagId, op: "add" }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(await db.memberTag.count({ where: { memberId: B.memberId } })).toBe(1);
      expect(await db.memberTag.count({ where: { memberId: A.memberId } })).toBe(0);
      expect(await db.activityTag.count({ where: { activityId: B.activityId } })).toBe(1);
    });
  });

  describe("audit log", () => {
    it("lists no entry of another organization", async () => {
      const { entries } = await listAuditLog(A.owner);
      expect(entries.some((e) => e.entity === "Member" && e.entityId === B.memberId)).toBe(false);
      expect(entries.some((e) => e.actorId === B.actorId)).toBe(false);
    });
  });
});

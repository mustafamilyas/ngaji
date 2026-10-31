import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { emptyDefinition, type Definition } from "@/lib/validation/member-view";
import type { Summary } from "@/lib/validation/summary";
import {
  resolveDefinitionGroupsLenient,
  resolveDefinitionGroupsStrict,
  resolveDefinitionTagsLenient,
  resolveDefinitionSummariesLenient,
  resolveDefinitionSummariesStrict,
  resolveDefinitionTagsStrict,
  resolveMemberView,
  resolveActivity,
  resolveGroup,
  resolveMember,
  resolveOccurrence,
  resolveSurvey,
  resolveTag,
  resolveUser,
  resolveVisibleTags,
} from "./resolve";
import type { SessionUser } from "./auth/session-user";

function sessionAt(groupId: number, groupPath: string): SessionUser {
  return {
    id: "1",
    username: "tester",
    name: "Tester",
    role: "ADMIN",
    groupId,
    groupPath,
    organizationId: 0,
    timeZone: "Asia/Jakarta",
    mustChangePassword: false,
  };
}

describe("lib/resolve", () => {
  let root: { id: number; path: string };
  let branchA: { id: number; path: string }; // under root
  let leafA: { id: number; path: string; organizationId: number }; // under branchA
  let branchB: { id: number; path: string }; // sibling of branchA, under root
  let owner: { id: number };

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Resolve Test Org" } });
    root = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
    });
    root = await db.group.update({ where: { id: root.id }, data: { path: `${root.id}/` } });

    const branch = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Branch A", path: "" },
    });
    branchA = await db.group.update({
      where: { id: branch.id },
      data: { path: `${root.path}${branch.id}/` },
    });

    const leaf = await db.group.create({
      data: { organizationId: organization.id, parentId: branchA.id, depth: 2, name: "Leaf A", path: "" },
    });
    leafA = await db.group.update({ where: { id: leaf.id }, data: { path: `${branchA.path}${leaf.id}/` } });

    const branch2 = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Branch B", path: "" },
    });
    branchB = await db.group.update({
      where: { id: branch2.id },
      data: { path: `${root.path}${branch2.id}/` },
    });

    owner = await db.user.create({
      data: { username: `resolve-owner-${root.id}`, passwordHash: "x", name: "Owner" },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("resolveGroup", () => {
    it("resolves a group within scope", async () => {
      const session = sessionAt(branchA.id, branchA.path);
      const group = await resolveGroup(session, leafA.id);
      expect(group.id).toBe(leafA.id);
    });

    it("throws NotFoundError for a group above the scope (ancestor)", async () => {
      const session = sessionAt(branchA.id, branchA.path);
      await expect(resolveGroup(session, root.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a sibling-branch group", async () => {
      const session = sessionAt(branchA.id, branchA.path);
      await expect(resolveGroup(session, branchB.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a non-existent id", async () => {
      const session = sessionAt(root.id, root.path);
      await expect(resolveGroup(session, 999_999)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted group even within scope", async () => {
      const deleted = await db.group.create({
        data: {
          organizationId: (await db.group.findUniqueOrThrow({ where: { id: root.id } })).organizationId,
          parentId: root.id,
          depth: 1,
          name: "Deleted Branch",
          path: `${root.path}999999/`,
          deletedAt: new Date(),
        },
      });
      const session = sessionAt(root.id, root.path);
      await expect(resolveGroup(session, deleted.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveMember", () => {
    it("resolves a member in scope and rejects one outside scope", async () => {
      const memberInA = await db.member.create({
        data: {
          groupId: leafA.id,
          name: "Anggota A",
          birthPlace: "Jakarta",
          birthDate: "2000-01-01",
          sex: "L",
          address: "-",
          phone: "0800000000",
          maritalStatus: "BELUM_MENIKAH",
          workStatus: "BEKERJA",
          joinedAt: "2024-01-01",
          createdById: owner.id,
        },
      });

      const inScope = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveMember(inScope, memberInA.id);
      expect(resolved.id).toBe(memberInA.id);

      const outOfScope = sessionAt(branchB.id, branchB.path);
      await expect(resolveMember(outOfScope, memberInA.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveActivity", () => {
    it("resolves an activity owned by the session's own group", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: branchA.id,
          name: "Kajian",
          location: "Aula",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-01",
          createdById: owner.id,
        },
      });
      const session = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveActivity(session, activity.id);
      expect(resolved.id).toBe(activity.id);
    });

    it("resolves an activity owned by an ancestor group (inherited, visible)", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: root.id,
          name: "Kajian Pusat",
          location: "Aula Pusat",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-01",
          createdById: owner.id,
        },
      });
      const session = sessionAt(leafA.id, leafA.path);
      const resolved = await resolveActivity(session, activity.id);
      expect(resolved.id).toBe(activity.id);
    });

    it("resolves an activity owned by a descendant group (visible to an ancestor session)", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: leafA.id,
          name: "Kajian Leaf",
          location: "Ruang Leaf",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-01",
          createdById: owner.id,
        },
      });
      const session = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveActivity(session, activity.id);
      expect(resolved.id).toBe(activity.id);
    });

    it("throws NotFoundError for an activity on a sibling branch", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: branchB.id,
          name: "Kajian B",
          location: "Aula B",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-01",
          createdById: owner.id,
        },
      });
      const session = sessionAt(branchA.id, branchA.path);
      await expect(resolveActivity(session, activity.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveSurvey", () => {
    function createSurvey(groupId: number, deletedAt: Date | null = null) {
      return db.survey.create({
        data: { groupId, title: "Survei Uji", createdById: owner.id, deletedAt },
      });
    }

    it("resolves a survey owned by the session's own group", async () => {
      const survey = await createSurvey(branchA.id);
      const resolved = await resolveSurvey(sessionAt(branchA.id, branchA.path), survey.id);
      expect(resolved.id).toBe(survey.id);
      expect(resolved.group.path).toBe(branchA.path);
    });

    it("resolves an inherited survey owned by an ancestor group", async () => {
      const survey = await createSurvey(root.id);
      const resolved = await resolveSurvey(sessionAt(leafA.id, leafA.path), survey.id);
      expect(resolved.id).toBe(survey.id);
    });

    it("resolves a survey owned by a descendant group", async () => {
      const survey = await createSurvey(leafA.id);
      const resolved = await resolveSurvey(sessionAt(branchA.id, branchA.path), survey.id);
      expect(resolved.id).toBe(survey.id);
    });

    it("throws NotFoundError for a survey on a sibling branch", async () => {
      const survey = await createSurvey(branchB.id);
      await expect(
        resolveSurvey(sessionAt(branchA.id, branchA.path), survey.id),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted survey", async () => {
      const survey = await createSurvey(branchA.id, new Date());
      await expect(
        resolveSurvey(sessionAt(branchA.id, branchA.path), survey.id),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a nonexistent id", async () => {
      await expect(
        resolveSurvey(sessionAt(branchA.id, branchA.path), 999_999),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveOccurrence", () => {
    it("resolves an occurrence whose activity is visible, and rejects one that isn't", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: branchA.id,
          name: "Kajian Occ",
          location: "Aula",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-04",
          createdById: owner.id,
        },
      });
      const occurrence = await db.activityOccurrence.create({
        data: { activityId: activity.id, date: "2026-01-04" },
      });

      const inScope = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveOccurrence(inScope, occurrence.id);
      expect(resolved.id).toBe(occurrence.id);

      const outOfScope = sessionAt(branchB.id, branchB.path);
      await expect(resolveOccurrence(outOfScope, occurrence.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a non-existent occurrence id", async () => {
      const session = sessionAt(root.id, root.path);
      await expect(resolveOccurrence(session, 999_999)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveUser", () => {
    it("resolves a user whose group is in scope and rejects one outside scope", async () => {
      const targetUser = await db.user.create({
        data: { username: `target-${leafA.id}`, passwordHash: "x", name: "Target" },
      });
      await db.userGroupRole.create({ data: { userId: targetUser.id, groupId: leafA.id, role: "USER" } });

      const inScope = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveUser(inScope, targetUser.id);
      expect(resolved.id).toBe(targetUser.id);

      const outOfScope = sessionAt(branchB.id, branchB.path);
      await expect(resolveUser(outOfScope, targetUser.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a user with no role assignment", async () => {
      const roleless = await db.user.create({
        data: { username: `roleless-${root.id}`, passwordHash: "x", name: "Roleless" },
      });
      const session = sessionAt(root.id, root.path);
      await expect(resolveUser(session, roleless.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveMemberView", () => {
    async function createView(groupId: number, ownerId: number, extra: { deletedAt?: Date } = {}) {
      return db.memberView.create({
        data: {
          groupId,
          ownerId,
          createdById: ownerId,
          name: `View ${Math.random()}`,
          definition: JSON.parse(JSON.stringify(emptyDefinition())),
          ...extra,
        },
      });
    }

    it("resolves a view with its owner's current state", async () => {
      await db.userGroupRole.create({ data: { userId: owner.id, groupId: branchA.id, role: "USER" } });
      const view = await createView(branchA.id, owner.id);

      const resolved = await resolveMemberView(sessionAt(branchA.id, branchA.path), view.id);
      expect(resolved).toMatchObject({
        id: view.id,
        groupId: branchA.id,
        ownerId: owner.id,
        ownerIsActive: true,
        ownerGroupId: branchA.id,
      });
    });

    it("reports a deactivated owner as inactive", async () => {
      const inactive = await db.user.create({
        data: { username: `inactive-${root.id}`, passwordHash: "x", name: "Inactive", isActive: false },
      });
      await db.userGroupRole.create({ data: { userId: inactive.id, groupId: branchA.id, role: "ADMIN" } });
      const view = await createView(branchA.id, inactive.id);

      const resolved = await resolveMemberView(sessionAt(branchA.id, branchA.path), view.id);
      expect(resolved.ownerIsActive).toBe(false);
    });

    it("reports a null owner group when the owner has no role assignment", async () => {
      const roleless = await db.user.create({
        data: { username: `view-roleless-${root.id}`, passwordHash: "x", name: "Roleless" },
      });
      const view = await createView(branchA.id, roleless.id);

      const resolved = await resolveMemberView(sessionAt(branchA.id, branchA.path), view.id);
      expect(resolved.ownerGroupId).toBeNull();
    });

    it("throws NotFoundError for a soft-deleted view", async () => {
      const view = await createView(branchA.id, owner.id, { deletedAt: new Date() });
      await expect(resolveMemberView(sessionAt(branchA.id, branchA.path), view.id)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(resolveMemberView(sessionAt(branchA.id, branchA.path), 999_999_999)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("definition group resolution", () => {
    function definitionWith(...ruleValues: number[][]): Definition {
      const definition = emptyDefinition();
      definition.filter.groups = ruleValues.map((value) => ({
        op: "AND" as const,
        rules: [{ field: "group" as const, operator: "inSubtreeOf" as const, value }],
      }));
      return definition;
    }

    describe("strict", () => {
      it("accepts group ids in the viewer's scope", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        await expect(
          resolveDefinitionGroupsStrict(session, definitionWith([branchA.id, leafA.id])),
        ).resolves.toBeUndefined();
      });

      it("accepts a definition without group rules", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        await expect(resolveDefinitionGroupsStrict(session, emptyDefinition())).resolves.toBeUndefined();
      });

      it("rejects a group outside the viewer's scope with ValidationError", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        await expect(resolveDefinitionGroupsStrict(session, definitionWith([branchB.id]))).rejects.toBeInstanceOf(
          ValidationError,
        );
      });

      it("rejects an ancestor of the viewer's group", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        await expect(resolveDefinitionGroupsStrict(session, definitionWith([root.id]))).rejects.toBeInstanceOf(
          ValidationError,
        );
      });

      it("rejects a nonexistent group", async () => {
        const session = sessionAt(root.id, root.path);
        await expect(resolveDefinitionGroupsStrict(session, definitionWith([999_999_999]))).rejects.toBeInstanceOf(
          ValidationError,
        );
      });

      it("rejects a soft-deleted group", async () => {
        const created = await db.group.create({
          data: { organizationId: leafA.organizationId, parentId: branchA.id, depth: 2, name: "Gone", path: "" },
        });
        const deleted = await db.group.update({
          where: { id: created.id },
          data: { path: `${branchA.path}${created.id}/`, deletedAt: new Date() },
        });
        const session = sessionAt(branchA.id, branchA.path);
        await expect(resolveDefinitionGroupsStrict(session, definitionWith([deleted.id]))).rejects.toBeInstanceOf(
          ValidationError,
        );
      });

      it("rejects when only one id of a rule is invalid", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        await expect(
          resolveDefinitionGroupsStrict(session, definitionWith([leafA.id, branchB.id])),
        ).rejects.toBeInstanceOf(ValidationError);
      });
    });

    describe("lenient", () => {
      it("keeps valid group rules untouched and reports nothing dropped", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        const definition = definitionWith([leafA.id]);
        const result = await resolveDefinitionGroupsLenient(session, definition);
        expect(result.definition).toEqual(definition);
        expect(result.dropped).toBe(false);
      });

      it("drops a rule whose group is out of scope and reports it", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        const result = await resolveDefinitionGroupsLenient(session, definitionWith([branchB.id], [leafA.id]));
        expect(result.dropped).toBe(true);
        expect(result.definition.filter.groups).toEqual([
          { op: "AND", rules: [{ field: "group", operator: "inSubtreeOf", value: [leafA.id] }] },
        ]);
      });

      it("drops the whole rule when only some of its ids are invalid", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        const result = await resolveDefinitionGroupsLenient(session, definitionWith([leafA.id, branchB.id]));
        expect(result.dropped).toBe(true);
        expect(result.definition.filter.groups).toEqual([]);
      });

      it("keeps other rules in a group and removes only the group rule", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        const definition = emptyDefinition();
        definition.filter.groups = [
          {
            op: "OR",
            rules: [
              { field: "sex", operator: "isAnyOf", value: ["L"] },
              { field: "group", operator: "inSubtreeOf", value: [branchB.id] },
            ],
          },
        ];
        const result = await resolveDefinitionGroupsLenient(session, definition);
        expect(result.dropped).toBe(true);
        expect(result.definition.filter.groups).toEqual([
          { op: "OR", rules: [{ field: "sex", operator: "isAnyOf", value: ["L"] }] },
        ]);
      });

      it("does not mutate its input", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        const definition = definitionWith([branchB.id]);
        const snapshot = structuredClone(definition);
        await resolveDefinitionGroupsLenient(session, definition);
        expect(definition).toEqual(snapshot);
      });
    });
  });

  describe("definition tag resolution", () => {
    const newTag = (groupId: number, key: string, extra: { deletedAt?: Date } = {}) =>
      db.tag.create({ data: { groupId, key, color: "blue", createdById: owner.id, ...extra } });

    function definitionWith(...ruleValues: number[][]): Definition {
      const definition = emptyDefinition();
      definition.filter.groups = ruleValues.map((value) => ({
        op: "AND" as const,
        rules: [{ field: "tag" as const, operator: "hasAnyOf" as const, value }],
      }));
      return definition;
    }
    const tagValues = (definition: Definition) => definition.filter.groups.map((g) => g.rules[0].value);

    describe("strict", () => {
      it("accepts own, inherited and descendant tags", async () => {
        const own = await newTag(branchA.id, "strict-own");
        const inherited = await newTag(root.id, "strict-inherited");
        const below = await newTag(leafA.id, "strict-below");
        const session = sessionAt(branchA.id, branchA.path);
        await expect(
          resolveDefinitionTagsStrict(session, definitionWith([own.id, inherited.id, below.id])),
        ).resolves.toBeUndefined();
      });

      it("accepts a definition without tag rules", async () => {
        await expect(resolveDefinitionTagsStrict(sessionAt(branchA.id, branchA.path), emptyDefinition())).resolves.toBeUndefined();
      });

      it("rejects a sibling-branch tag", async () => {
        const sibling = await newTag(branchB.id, "strict-sibling");
        await expect(
          resolveDefinitionTagsStrict(sessionAt(branchA.id, branchA.path), definitionWith([sibling.id])),
        ).rejects.toBeInstanceOf(ValidationError);
      });

      it("rejects an unknown id and a deleted tag with the same error", async () => {
        const deleted = await newTag(branchA.id, "strict-gone", { deletedAt: new Date() });
        const session = sessionAt(branchA.id, branchA.path);
        const unknown = await resolveDefinitionTagsStrict(session, definitionWith([999_999_999])).catch((e) => e);
        const gone = await resolveDefinitionTagsStrict(session, definitionWith([deleted.id])).catch((e) => e);
        expect(unknown).toBeInstanceOf(ValidationError);
        expect(gone).toBeInstanceOf(ValidationError);
        expect(gone.message).toBe(unknown.message);
      });

      it("rejects a tag of another organization with the same error as an unknown id", async () => {
        const otherOrg = await db.organization.create({ data: { name: "Other Rule Tag Org" } });
        const otherRoot = await db.group.create({ data: { organizationId: otherOrg.id, depth: 0, name: "Other Root", path: "" } });
        await db.group.update({ where: { id: otherRoot.id }, data: { path: `${otherRoot.id}/` } });
        const foreign = await newTag(otherRoot.id, "strict-foreign");
        const session = sessionAt(branchA.id, branchA.path);
        const foreignError = await resolveDefinitionTagsStrict(session, definitionWith([foreign.id])).catch((e) => e);
        const unknownError = await resolveDefinitionTagsStrict(session, definitionWith([999_999_999])).catch((e) => e);
        expect(foreignError).toBeInstanceOf(ValidationError);
        expect(foreignError.message).toBe(unknownError.message);
      });

      it("rejects when one id of several is unusable", async () => {
        const own = await newTag(branchA.id, "strict-mixed-own");
        const sibling = await newTag(branchB.id, "strict-mixed-sibling");
        await expect(
          resolveDefinitionTagsStrict(sessionAt(branchA.id, branchA.path), definitionWith([own.id, sibling.id])),
        ).rejects.toBeInstanceOf(ValidationError);
      });
    });

    describe("lenient", () => {
      it("keeps visible tags and reports nothing dropped", async () => {
        const own = await newTag(branchA.id, "lenient-own");
        const inherited = await newTag(root.id, "lenient-inherited");
        const result = await resolveDefinitionTagsLenient(sessionAt(branchA.id, branchA.path), definitionWith([own.id, inherited.id]));
        expect(result.dropped).toBe(false);
        expect(tagValues(result.definition)).toEqual([[own.id, inherited.id]]);
      });

      it("removes unusable ids from a rule and keeps the rest", async () => {
        const own = await newTag(branchA.id, "lenient-keep");
        const sibling = await newTag(branchB.id, "lenient-sibling");
        const deleted = await newTag(branchA.id, "lenient-gone", { deletedAt: new Date() });
        const result = await resolveDefinitionTagsLenient(
          sessionAt(branchA.id, branchA.path),
          definitionWith([own.id, sibling.id, deleted.id, 999_999_999]),
        );
        expect(result.dropped).toBe(true);
        expect(tagValues(result.definition)).toEqual([[own.id]]);
      });

      it("drops a rule left with no ids, and its group, but keeps other rules", async () => {
        const gone = await newTag(branchA.id, "lenient-only", { deletedAt: new Date() });
        const definition = definitionWith([gone.id]);
        definition.filter.groups.push({ op: "AND", rules: [{ field: "sex", operator: "isAnyOf", value: ["L"] }] });
        const result = await resolveDefinitionTagsLenient(sessionAt(branchA.id, branchA.path), definition);
        expect(result.dropped).toBe(true);
        expect(result.definition.filter.groups).toEqual([{ op: "AND", rules: [{ field: "sex", operator: "isAnyOf", value: ["L"] }] }]);
      });

      it("does not mutate its input", async () => {
        const gone = await newTag(branchA.id, "lenient-nomutate", { deletedAt: new Date() });
        const definition = definitionWith([gone.id]);
        await resolveDefinitionTagsLenient(sessionAt(branchA.id, branchA.path), definition);
        expect(tagValues(definition)).toEqual([[gone.id]]);
      });
    });
  });

  describe("definition summary resolution", () => {
    const newTag = (groupId: number, key: string, value: string | null, extra: { deletedAt?: Date } = {}) =>
      db.tag.create({ data: { groupId, key, value, color: "blue", createdById: owner.id, ...extra } });

    function definitionWith(...dimensions: Summary["dimension"][]): Definition {
      return { ...emptyDefinition(), summaries: dimensions.map((dimension) => ({ dimension })) };
    }
    const kinds = (definition: Definition) => (definition.summaries ?? []).map((s) => s.dimension.kind);

    describe("strict", () => {
      it("accepts a definition without summaries and summaries without tags", async () => {
        const session = sessionAt(branchA.id, branchA.path);
        await expect(resolveDefinitionSummariesStrict(session, emptyDefinition())).resolves.toBeUndefined();
        await expect(
          resolveDefinitionSummariesStrict(session, definitionWith({ kind: "property", field: "sex" })),
        ).resolves.toBeUndefined();
      });

      it("accepts own, inherited and descendant tags as key anchor and as simple tag", async () => {
        const own = await newTag(branchA.id, "sum-strict-own", "a");
        const inherited = await newTag(root.id, "sum-strict-inh", null);
        const below = await newTag(leafA.id, "sum-strict-below", "b");
        await expect(
          resolveDefinitionSummariesStrict(
            sessionAt(branchA.id, branchA.path),
            definitionWith({ kind: "tagKey", tagId: own.id }, { kind: "tag", tagId: inherited.id }, { kind: "tagKey", tagId: below.id }),
          ),
        ).resolves.toBeUndefined();
      });

      it("rejects a sibling-branch tag", async () => {
        const sibling = await newTag(branchB.id, "sum-strict-sibling", "x");
        await expect(
          resolveDefinitionSummariesStrict(sessionAt(branchA.id, branchA.path), definitionWith({ kind: "tagKey", tagId: sibling.id })),
        ).rejects.toBeInstanceOf(ValidationError);
      });

      it("rejects an unknown id and a deleted tag with the same error", async () => {
        const deleted = await newTag(branchA.id, "sum-strict-gone", "x", { deletedAt: new Date() });
        const session = sessionAt(branchA.id, branchA.path);
        const unknown = await resolveDefinitionSummariesStrict(session, definitionWith({ kind: "tagKey", tagId: 999_999_999 })).catch((e) => e);
        const gone = await resolveDefinitionSummariesStrict(session, definitionWith({ kind: "tagKey", tagId: deleted.id })).catch((e) => e);
        expect(unknown).toBeInstanceOf(ValidationError);
        expect(gone.message).toBe(unknown.message);
      });

      it("rejects a tag of another organization with the same error as an unknown id", async () => {
        const otherOrg = await db.organization.create({ data: { name: "Other Summary Tag Org" } });
        const otherRoot = await db.group.create({ data: { organizationId: otherOrg.id, depth: 0, name: "Other Root", path: "" } });
        await db.group.update({ where: { id: otherRoot.id }, data: { path: `${otherRoot.id}/` } });
        const foreign = await newTag(otherRoot.id, "sum-strict-foreign", "x");
        const session = sessionAt(branchA.id, branchA.path);
        const foreignError = await resolveDefinitionSummariesStrict(session, definitionWith({ kind: "tagKey", tagId: foreign.id })).catch((e) => e);
        const unknownError = await resolveDefinitionSummariesStrict(session, definitionWith({ kind: "tagKey", tagId: 999_999_999 })).catch((e) => e);
        expect(foreignError).toBeInstanceOf(ValidationError);
        expect(foreignError.message).toBe(unknownError.message);
      });

      it("rejects a key summary anchored on a simple tag and a simple-tag summary on a key value", async () => {
        const simple = await newTag(branchA.id, "sum-strict-simple", null);
        const valued = await newTag(branchA.id, "sum-strict-valued", "v");
        const session = sessionAt(branchA.id, branchA.path);
        await expect(
          resolveDefinitionSummariesStrict(session, definitionWith({ kind: "tagKey", tagId: simple.id })),
        ).rejects.toBeInstanceOf(ValidationError);
        await expect(
          resolveDefinitionSummariesStrict(session, definitionWith({ kind: "tag", tagId: valued.id })),
        ).rejects.toBeInstanceOf(ValidationError);
      });
    });

    describe("lenient", () => {
      it("keeps usable summaries in order and reports nothing dropped", async () => {
        const own = await newTag(branchA.id, "sum-len-own", "a");
        const result = await resolveDefinitionSummariesLenient(
          sessionAt(branchA.id, branchA.path),
          definitionWith({ kind: "property", field: "sex" }, { kind: "tagKey", tagId: own.id }),
        );
        expect(result.dropped).toBe(false);
        expect(kinds(result.definition)).toEqual(["property", "tagKey"]);
      });

      it("drops summaries of sibling, deleted, unknown and mismatched tags and flags it", async () => {
        const sibling = await newTag(branchB.id, "sum-len-sibling", "x");
        const deleted = await newTag(branchA.id, "sum-len-gone", null, { deletedAt: new Date() });
        const valued = await newTag(branchA.id, "sum-len-valued", "v");
        const result = await resolveDefinitionSummariesLenient(
          sessionAt(branchA.id, branchA.path),
          definitionWith(
            { kind: "tagKey", tagId: sibling.id },
            { kind: "tag", tagId: deleted.id },
            { kind: "tagKey", tagId: 999_999_999 },
            { kind: "tag", tagId: valued.id },
            { kind: "property", field: "status" },
          ),
        );
        expect(result.dropped).toBe(true);
        expect(kinds(result.definition)).toEqual(["property"]);
      });

      it("drops a key summary whose anchor value was deleted, even if the key has other values", async () => {
        const anchor = await newTag(branchA.id, "sum-len-anchor", "a", { deletedAt: new Date() });
        await newTag(branchA.id, "sum-len-anchor", "b");
        const result = await resolveDefinitionSummariesLenient(
          sessionAt(branchA.id, branchA.path),
          definitionWith({ kind: "tagKey", tagId: anchor.id }),
        );
        expect(result.dropped).toBe(true);
        expect(result.definition.summaries).toEqual([]);
      });

      it("does not mutate its input", async () => {
        const gone = await newTag(branchA.id, "sum-len-nomutate", null, { deletedAt: new Date() });
        const definition = definitionWith({ kind: "tag", tagId: gone.id });
        await resolveDefinitionSummariesLenient(sessionAt(branchA.id, branchA.path), definition);
        expect(definition.summaries).toHaveLength(1);
      });
    });
  });

  describe("resolveTag / resolveVisibleTags", () => {
    const newTag = (groupId: number, key: string, extra: { deletedAt?: Date } = {}) =>
      db.tag.create({ data: { groupId, key, color: "blue", createdById: owner.id, ...extra } });

    it("resolves a tag owned by the caller's group, an ancestor, or a descendant", async () => {
      const own = await newTag(branchA.id, "own");
      const inherited = await newTag(root.id, "inherited");
      const below = await newTag(leafA.id, "below");
      const session = sessionAt(branchA.id, branchA.path);
      for (const tag of [own, inherited, below]) {
        expect((await resolveTag(session, tag.id)).id).toBe(tag.id);
      }
    });

    it("includes the owner group so callers can run the pure access rules", async () => {
      const tag = await newTag(root.id, "with-group");
      const resolved = await resolveTag(sessionAt(branchA.id, branchA.path), tag.id);
      expect(resolved.group.path).toBe(root.path);
    });

    it("throws NotFoundError for a sibling-branch tag", async () => {
      const tag = await newTag(branchB.id, "sibling");
      await expect(resolveTag(sessionAt(branchA.id, branchA.path), tag.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a missing id and a soft-deleted tag", async () => {
      const deleted = await newTag(branchA.id, "gone", { deletedAt: new Date() });
      const session = sessionAt(branchA.id, branchA.path);
      await expect(resolveTag(session, 999_999)).rejects.toBeInstanceOf(NotFoundError);
      await expect(resolveTag(session, deleted.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a tag of another organization", async () => {
      const otherOrg = await db.organization.create({ data: { name: "Other Tag Org" } });
      const otherRoot = await db.group.create({
        data: { organizationId: otherOrg.id, depth: 0, name: "Other Root", path: "" },
      });
      await db.group.update({ where: { id: otherRoot.id }, data: { path: `${otherRoot.id}/` } });
      const tag = await newTag(otherRoot.id, "foreign");
      await expect(resolveTag(sessionAt(root.id, root.path), tag.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("list variant keeps visible tags in input order, de-duplicated, and drops the rest without throwing", async () => {
      const a = await newTag(root.id, "list-a");
      const b = await newTag(leafA.id, "list-b");
      const sibling = await newTag(branchB.id, "list-sibling");
      const deleted = await newTag(branchA.id, "list-gone", { deletedAt: new Date() });
      const session = sessionAt(branchA.id, branchA.path);

      const tags = await resolveVisibleTags(session, [b.id, sibling.id, a.id, 999_999, deleted.id, b.id]);
      expect(tags.map((t) => t.id)).toEqual([b.id, a.id]);
    });

    it("list variant returns [] for an empty input", async () => {
      expect(await resolveVisibleTags(sessionAt(root.id, root.path), [])).toEqual([]);
    });
  });
});

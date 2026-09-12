import { activityHasConflict } from "@/lib/activity/conflict-check";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { addDays } from "@/lib/dates";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { resolveActivity } from "@/lib/resolve";
import type {
  ActivityInput,
  ActivitySplitInput,
  EndActivityInput,
} from "@/lib/validation/activity";

type TemplateFields = Omit<ActivityInput, "groupId">;

function withoutGroup<T extends { group: unknown }>(entity: T): Omit<T, "group"> {
  const { group, ...rest } = entity;
  void group;
  return rest;
}

function templateData(input: TemplateFields) {
  return {
    name: input.name,
    location: input.location,
    notes: input.notes ?? null,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    freq: input.freq,
    interval: input.interval,
    weekdays: input.weekdays,
    monthDay: input.monthDay ?? null,
    startsOn: input.startsOn,
    endsOn: input.endsOn ?? null,
  };
}

export async function createActivity(session: SessionUser, input: ActivityInput) {
  authorize(session, "activity.create", { groupId: input.groupId });

  const activity = await db.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: { groupId: input.groupId, createdById: Number(session.id), ...templateData(input) },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "activity.create",
      entity: "Activity",
      entityId: created.id,
      groupId: created.groupId,
      after: created,
    });
    return created;
  });

  const hasConflict = await activityHasConflict(activity.id, session.groupPath);
  return { activity, hasConflict };
}

export async function updateActivity(session: SessionUser, activityId: number, input: TemplateFields) {
  const { group, ...before } = await resolveActivity(session, activityId);
  authorize(session, "activity.update", { groupId: before.groupId });

  const activity = await db.$transaction(async (tx) => {
    const updated = await tx.activity.update({ where: { id: before.id }, data: templateData(input) });
    await audit(tx, {
      actorId: Number(session.id),
      action: "activity.update",
      entity: "Activity",
      entityId: before.id,
      groupId: before.groupId,
      before,
      after: updated,
    });
    return updated;
  });

  const hasConflict = await activityHasConflict(activity.id, group.path);
  return { activity, hasConflict };
}

/** "Akhiri mulai tanggal X" (DESIGN.md §5.5): `endsOn = X-1`, or soft-delete when `X <= startsOn`. */
export async function endActivity(session: SessionUser, input: EndActivityInput) {
  const before = withoutGroup(await resolveActivity(session, input.activityId));
  authorize(session, "activity.update", { groupId: before.groupId });

  if (input.fromDate <= before.startsOn) {
    return db.$transaction(async (tx) => {
      const deleted = await tx.activity.update({
        where: { id: before.id },
        data: { deletedAt: new Date() },
      });
      await audit(tx, {
        actorId: Number(session.id),
        action: "activity.delete",
        entity: "Activity",
        entityId: before.id,
        groupId: before.groupId,
        before,
        after: { deletedAt: deleted.deletedAt },
      });
      return deleted;
    });
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.activity.update({
      where: { id: before.id },
      data: { endsOn: addDays(input.fromDate, -1) },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "activity.update",
      entity: "Activity",
      entityId: before.id,
      groupId: before.groupId,
      before,
      after: updated,
    });
    return updated;
  });
}

export async function deleteActivity(session: SessionUser, activityId: number) {
  const before = withoutGroup(await resolveActivity(session, activityId));
  authorize(session, "activity.delete", { groupId: before.groupId });

  return db.$transaction(async (tx) => {
    const deleted = await tx.activity.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "activity.delete",
      entity: "Activity",
      entityId: before.id,
      groupId: before.groupId,
      before,
      after: { deletedAt: deleted.deletedAt },
    });
    return deleted;
  });
}

/**
 * "Move this and following" (DESIGN.md §5.5): `input.startsOn` doubles as
 * `fromDate` X. `X <= original.startsOn` edits in place; otherwise the
 * original ends the day before X, a new activity is created from X carrying
 * `continuesFromId`, and occurrence rows with `date >= X` move to it.
 */
export async function splitActivity(session: SessionUser, input: ActivitySplitInput) {
  const { group, ...original } = await resolveActivity(session, input.activityId);
  authorize(session, "activity.split", { groupId: original.groupId });

  if (original.freq === "ONCE") {
    throw new ValidationError("Kegiatan sekali tidak bisa digeser \"ini & seterusnya\"");
  }

  const fromDate = input.startsOn;

  if (fromDate <= original.startsOn) {
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.activity.update({ where: { id: original.id }, data: templateData(input) });
      await audit(tx, {
        actorId: Number(session.id),
        action: "activity.update",
        entity: "Activity",
        entityId: original.id,
        groupId: original.groupId,
        before: original,
        after: result,
      });
      return result;
    });
    const hasConflict = await activityHasConflict(updated.id, group.path);
    return { activity: updated, splitCreated: false as const, hasConflict };
  }

  const created = await db.$transaction(async (tx) => {
    await tx.activity.update({
      where: { id: original.id },
      data: { endsOn: addDays(fromDate, -1) },
    });

    const newActivity = await tx.activity.create({
      data: {
        groupId: original.groupId,
        createdById: Number(session.id),
        continuesFromId: original.id,
        ...templateData(input),
      },
    });

    await tx.activityOccurrence.updateMany({
      where: { activityId: original.id, date: { gte: fromDate } },
      data: { activityId: newActivity.id },
    });

    await audit(tx, {
      actorId: Number(session.id),
      action: "activity.split",
      entity: "Activity",
      entityId: original.id,
      groupId: original.groupId,
      after: { fromActivityId: original.id, toActivityId: newActivity.id, fromDate },
    });

    return newActivity;
  });

  const hasConflict = await activityHasConflict(created.id, group.path);
  return { activity: created, splitCreated: true as const, hasConflict };
}

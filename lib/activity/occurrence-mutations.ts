import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows as loadRows } from "@/lib/activity/rows";
import { toActivityTemplate } from "@/lib/activity/template";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { resolveActivity } from "@/lib/resolve";
import type { OccurrenceOverrideInput } from "@/lib/validation/occurrence";

/**
 * Cancel, change time/duration/location/notes, or move once (DESIGN.md
 * §5.5 "occurrence.override"). `input.date` must be a rule date the
 * activity actually generates (or that already has attendance); the target
 * of a move must not already be an occurrence of the same activity.
 */
export async function overrideOccurrence(session: SessionUser, input: OccurrenceOverrideInput) {
  const activity = await resolveActivity(session, input.activityId);
  authorize(session, "occurrence.override", { groupId: activity.groupId });

  const template = toActivityTemplate(activity);

  const ownRows = await loadRows(activity.id, input.date, input.date);
  const validAtSource = occurrencesFor(template, input.date, input.date, ownRows).some(
    (occurrence) => occurrence.key === input.date,
  );
  if (!validAtSource) throw new NotFoundError();

  if (input.overrideDate !== undefined && input.overrideDate !== input.date) {
    const targetRows = await loadRows(activity.id, input.overrideDate, input.overrideDate);
    const targetTaken = occurrencesFor(
      template,
      input.overrideDate,
      input.overrideDate,
      targetRows.filter((row) => row.date !== input.date),
    ).some((occurrence) => occurrence.key === input.overrideDate);
    if (targetTaken) {
      throw new ValidationError("Tanggal tujuan sudah menjadi occurrence lain kegiatan ini");
    }
  }

  return db.$transaction(async (tx) => {
    const before = await tx.activityOccurrence.findUnique({
      where: { activityId_date: { activityId: activity.id, date: input.date } },
    });

    const data = {
      status: input.status,
      overrideDate: input.overrideDate ?? null,
      overrideStartTime: input.overrideStartTime ?? null,
      overrideDurationMinutes: input.overrideDurationMinutes ?? null,
      overrideLocation: input.overrideLocation ?? null,
      overrideNotes: input.overrideNotes ?? null,
    };

    const updated = await tx.activityOccurrence.upsert({
      where: { activityId_date: { activityId: activity.id, date: input.date } },
      create: { activityId: activity.id, date: input.date, ...data },
      update: data,
    });

    await audit(tx, {
      actorId: Number(session.id),
      action: "occurrence.override",
      entity: "ActivityOccurrence",
      entityId: updated.id,
      groupId: activity.groupId,
      before,
      after: updated,
    });

    return updated;
  });
}

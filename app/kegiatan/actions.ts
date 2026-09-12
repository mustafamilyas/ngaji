"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createActivity,
  deleteActivity,
  endActivity,
  splitActivity,
  updateActivity,
} from "@/lib/activity/mutations";
import { overrideOccurrence } from "@/lib/activity/occurrence-mutations";
import { saveAttendance } from "@/lib/attendance/save";
import type { Activity, ActivityOccurrence } from "@/lib/generated/prisma/client";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import {
  activitySchema,
  activitySplitSchema,
  activityUpdateSchema,
  deleteActivitySchema,
  endActivitySchema,
} from "@/lib/validation/activity";
import { attendanceSaveSchema } from "@/lib/validation/attendance";
import { occurrenceOverrideSchema } from "@/lib/validation/occurrence";

async function requireSession() {
  const session = await auth();
  if (!session) redirect("/login");
  return session.user;
}

type CreateResult = ActionResult<{ activity: Activity; hasConflict: boolean }>;

/**
 * `groupId` is always the caller's own group (DESIGN.md §3.2 "kegiatan milik
 * grup user sendiri") — set here from the session rather than trusted from
 * `input`, so the create form never needs a group field at all.
 */
export async function createActivityAction(input: unknown): Promise<CreateResult> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = activitySchema.safeParse({ ...(input as Record<string, unknown>), groupId: session.groupId });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return createActivity(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/kegiatan");
    revalidatePath(`/grup/${result.data.activity.groupId}`);
  }
  return result;
}

export async function updateActivityAction(activityId: number, input: unknown): Promise<CreateResult> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = activityUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return updateActivity(session, activityId, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/kegiatan");
    revalidatePath(`/kegiatan/${activityId}`);
  }
  return result;
}

export async function splitActivityAction(input: unknown): Promise<CreateResult & { splitCreated?: boolean }> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = activitySplitSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return splitActivity(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/kegiatan");
    revalidatePath(`/kegiatan/${result.data.activity.id}`);
  }
  return result;
}

export async function endActivityAction(
  _prevState: ActionResult<Activity> | null,
  formData: FormData,
): Promise<ActionResult<Activity>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = endActivitySchema.safeParse({
      activityId: formData.get("activityId"),
      fromDate: formData.get("fromDate"),
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return endActivity(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/kegiatan");
    revalidatePath(`/kegiatan/${result.data.id}`);
  }
  return result;
}

/** Redirects to `/kegiatan` on success, so it never resolves to `{ ok: true }`. */
export async function deleteActivityAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const session = await requireSession();
  return runAction(async () => {
    const parsed = deleteActivitySchema.safeParse({ activityId: formData.get("activityId") });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    await deleteActivity(session, parsed.data.activityId);
    revalidatePath("/kegiatan");
    redirect("/kegiatan");
  });
}

export async function overrideOccurrenceAction(
  _prevState: ActionResult<ActivityOccurrence> | null,
  formData: FormData,
): Promise<ActionResult<ActivityOccurrence>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = occurrenceOverrideSchema.safeParse({
      activityId: formData.get("activityId"),
      date: formData.get("date"),
      status: formData.get("status"),
      overrideDate: formData.get("overrideDate") ?? "",
      overrideStartTime: formData.get("overrideStartTime") ?? "",
      overrideDurationMinutes: formData.get("overrideDurationMinutes") || undefined,
      overrideLocation: formData.get("overrideLocation") ?? "",
      overrideNotes: formData.get("overrideNotes") ?? "",
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return overrideOccurrence(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/kegiatan");
    revalidatePath(`/kegiatan/${result.data.activityId}`);
  }
  return result;
}

export async function saveAttendanceAction(
  input: unknown,
): Promise<ActionResult<{ set: { memberId: number; status: string }[]; removed: number[] }>> {
  const session = await requireSession();
  const parsedActivityId = attendanceSaveSchema.shape.activityId.safeParse(
    (input as { activityId?: unknown })?.activityId,
  );
  const result = await runAction(async () => {
    const parsed = attendanceSaveSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return saveAttendance(session, parsed.data);
  });
  if (result.ok && parsedActivityId.success) {
    revalidatePath(`/kegiatan/${parsedActivityId.data}`);
  }
  return result;
}

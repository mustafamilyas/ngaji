"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/require-session";
import {
  createActivity,
  deleteActivity,
  endActivity,
  splitActivity,
  updateActivity,
} from "@/lib/activity/mutations";
import { overrideOccurrence } from "@/lib/activity/occurrence-mutations";
import { checkInMember, listCheckInMembers } from "@/lib/attendance/check-in";
import { saveAttendance } from "@/lib/attendance/save";
import { setMemberAttendance } from "@/lib/attendance/set";
import type { Activity, ActivityOccurrence } from "@/lib/generated/prisma/client";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import {
  activitySchema,
  activitySplitSchema,
  activityUpdateSchema,
  deleteActivitySchema,
  endActivitySchema,
} from "@/lib/validation/activity";
import {
  attendanceSaveSchema,
  attendanceSetSchema,
  checkInMembersSchema,
  checkInSchema,
} from "@/lib/validation/attendance";
import { idSchema } from "@/lib/validation/common";
import { occurrenceOverrideSchema } from "@/lib/validation/occurrence";

type CreateResult = ActionResult<{ activity: Activity; hasConflict: boolean }>;

/**
 * `input.groupId` is the owning group picked in the form. Never trusted:
 * `createActivity` resolves it in scope and requires an ADMIN+ role there
 * (own group or an additional role, DESIGN.md §3.2a). Defaults to the
 * caller's own group when omitted.
 */
export async function createActivityAction(input: unknown): Promise<CreateResult> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = activitySchema.safeParse({ ...(input as Record<string, unknown>), groupId: (input as { groupId?: unknown })?.groupId ?? session.groupId });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return createActivity(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/dashboard/kegiatan");
    revalidatePath(`/dashboard/grup/${result.data.activity.groupId}`);
  }
  return result;
}

export async function updateActivityAction(activityId: unknown, input: unknown): Promise<CreateResult> {
  const session = await requireSession();
  let validId: number | undefined;
  const result = await runAction(async () => {
    const parsedId = idSchema.safeParse(activityId);
    const parsed = activityUpdateSchema.safeParse(input);
    if (!parsedId.success) throw new ValidationError("Data tidak valid");
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    validId = parsedId.data;
    return updateActivity(session, parsedId.data, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/dashboard/kegiatan");
    revalidatePath(`/dashboard/kegiatan/${validId}`);
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
    revalidatePath("/dashboard/kegiatan");
    revalidatePath(`/dashboard/kegiatan/${result.data.activity.id}`);
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
    revalidatePath("/dashboard/kegiatan");
    revalidatePath(`/dashboard/kegiatan/${result.data.id}`);
  }
  return result;
}

/** Redirects to `/dashboard/kegiatan` on success, so it never resolves to `{ ok: true }`. */
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
    revalidatePath("/dashboard/kegiatan");
    redirect("/dashboard/kegiatan");
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
    revalidatePath("/dashboard/kegiatan");
    revalidatePath(`/dashboard/kegiatan/${result.data.activityId}`);
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
    revalidatePath(`/dashboard/kegiatan/${parsedActivityId.data}`);
  }
  return result;
}

export async function setAttendanceAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof setMemberAttendance>>>> {
  const session = await requireSession();
  const parsed = attendanceSetSchema.safeParse(input);
  const result = await runAction(async () => {
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return setMemberAttendance(session, parsed.data);
  });
  if (result.ok && parsed.success) {
    revalidatePath(`/dashboard/kegiatan/${parsed.data.activityId}`);
  }
  return result;
}

export async function listCheckInMembersAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof listCheckInMembers>>>> {
  const session = await requireSession();
  return runAction(async () => {
    const parsed = checkInMembersSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return listCheckInMembers(session, parsed.data);
  });
}

export async function checkInAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof checkInMember>>>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = checkInSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return checkInMember(session, parsed.data);
  });
  if (result.ok) {
    const activityId = checkInSchema.shape.activityId.safeParse((input as { activityId?: unknown })?.activityId);
    if (activityId.success) revalidatePath(`/dashboard/kegiatan/${activityId.data}`);
  }
  return result;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import { createSurvey, deleteSurvey, updateSurvey } from "@/lib/survey/mutations";
import { deleteResponse, saveResponse } from "@/lib/survey/responses";
import { idSchema } from "@/lib/validation/common";
import { surveyFormSchema, surveyResponseDeleteSchema, surveyResponseSaveSchema } from "@/lib/validation/survey";

/**
 * The owning group is always the caller's own group (DESIGN.md §3.2) — it is
 * taken from the session inside `createSurvey`; any `groupId` in `input` is
 * stripped by the schema and never read.
 */
export async function createSurveyAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = surveyFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    const survey = await createSurvey(session, parsed.data);
    return { id: survey.id };
  });
  if (result.ok) revalidatePath("/dashboard/survei");
  return result;
}

export async function updateSurveyAction(surveyId: unknown, input: unknown): Promise<ActionResult<{ id: number }>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsedId = idSchema.safeParse(surveyId);
    if (!parsedId.success) throw new ValidationError("Data tidak valid");
    const parsed = surveyFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    const survey = await updateSurvey(session, parsedId.data, parsed.data);
    return { id: survey.id };
  });
  if (result.ok) {
    revalidatePath("/dashboard/survei");
    revalidatePath(`/dashboard/survei/${result.data.id}`);
  }
  return result;
}

const deleteSurveySchema = z.object({ surveyId: idSchema });

/** Redirects to `/dashboard/survei` on success, so it never resolves to `{ ok: true }`. */
export async function deleteSurveyAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const session = await requireSession();
  return runAction(async () => {
    const parsed = deleteSurveySchema.safeParse({ surveyId: formData.get("surveyId") });
    if (!parsed.success) throw new ValidationError("Data tidak valid");
    await deleteSurvey(session, parsed.data.surveyId);
    revalidatePath("/dashboard/survei");
    redirect("/dashboard/survei");
  });
}

/** Saves (replaces) one member's answers; `surveyId`/`memberId` are resolved and authorized in `saveResponse`. */
export async function saveSurveyResponseAction(input: unknown): Promise<ActionResult<{ memberId: number }>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = surveyResponseSaveSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Data tidak valid");
    await saveResponse(session, parsed.data);
    return { memberId: parsed.data.memberId };
  });
  if (result.ok) revalidatePath("/dashboard/survei", "layout");
  return result;
}

/** Removes one member's response; ids are resolved and authorized in `deleteResponse`. */
export async function deleteSurveyResponseAction(input: unknown): Promise<ActionResult<{ memberId: number }>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = surveyResponseDeleteSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Data tidak valid");
    await deleteResponse(session, parsed.data);
    return { memberId: parsed.data.memberId };
  });
  if (result.ok) revalidatePath("/dashboard/survei", "layout");
  return result;
}

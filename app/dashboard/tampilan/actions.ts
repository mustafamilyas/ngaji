"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { VIEW_MAX_DRAFT_LENGTH } from "@/lib/constants";
import { type ActionResult, NotFoundError, ValidationError, runAction } from "@/lib/errors";
import { loadViewDefinition } from "@/lib/member-view/load";
import { createMemberView, deleteMemberView, transferMemberView, updateMemberView } from "@/lib/member-view/mutations";
import { loadSectionMembers } from "@/lib/member-view/sections";
import { createMemberViewSchema, memberViewIdSchema, updateMemberViewSchema } from "@/lib/validation/member-view";

const loadSectionSchema = z.object({
  viewId: z.number().int().positive().nullable(),
  draft: z.string().max(VIEW_MAX_DRAFT_LENGTH).optional(),
  key: z.string().min(1).max(40),
  offset: z.number().int().min(0).max(1_000_000),
});

/**
 * "Tampilkan lebih banyak" / first expand of a collapsed section. Nothing the
 * client sends is trusted: the view is re-resolved and authorized, the draft is
 * re-validated, and the section is re-derived from the definition and `key`.
 */
export async function loadSectionAction(input: unknown) {
  const session = await requireSession();
  return runAction(async () => {
    const parsed = loadSectionSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Data tidak valid");
    const { viewId, draft, key, offset } = parsed.data;

    const loaded = await loadViewDefinition(session, viewId, draft);
    const result = await loadSectionMembers(session, loaded.definition, key, offset);
    if (!result) throw new NotFoundError();
    return { members: result.members, hasMore: result.hasMore };
  });
}

export type LoadSectionResult = Awaited<ReturnType<typeof loadSectionAction>> extends ActionResult<infer T> ? T : never;

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Data tidak valid";

/** "Simpan sebagai baru": the owning group comes from the session inside `createMemberView`, never from `input`. */
export async function createMemberViewAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = createMemberViewSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const view = await createMemberView(session, parsed.data);
    return { id: view.id };
  });
  if (result.ok) revalidatePath("/dashboard/tampilan");
  return result;
}

/** "Simpan" (definition) and rename (name); the view is resolved and owner-checked in `updateMemberView`. */
export async function updateMemberViewAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = updateMemberViewSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const view = await updateMemberView(session, parsed.data);
    return { id: view.id };
  });
  if (result.ok) {
    revalidatePath("/dashboard/tampilan");
    revalidatePath(`/dashboard/tampilan/${result.data.id}`);
  }
  return result;
}

export async function deleteMemberViewAction(input: unknown): Promise<ActionResult<null>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = memberViewIdSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Data tidak valid");
    await deleteMemberView(session, parsed.data);
    return null;
  });
  if (result.ok) revalidatePath("/dashboard/tampilan");
  return result;
}

/** "Ambil alih": only an ADMIN/OWNER of the view's group, only while the view is orphaned (`authorize`). */
export async function transferMemberViewAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = memberViewIdSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Data tidak valid");
    const view = await transferMemberView(session, parsed.data);
    return { id: view.id };
  });
  if (result.ok) {
    revalidatePath("/dashboard/tampilan");
    revalidatePath(`/dashboard/tampilan/${result.data.id}`);
  }
  return result;
}

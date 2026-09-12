"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Group } from "@/lib/generated/prisma/client";
import { createGroup, deleteGroup, renameGroup } from "@/lib/group/mutations";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import { createGroupSchema, deleteGroupSchema, renameGroupSchema } from "@/lib/validation/group";

async function requireSession() {
  const session = await auth();
  if (!session) redirect("/login");
  return session.user;
}

export async function createGroupAction(
  _prevState: ActionResult<Group> | null,
  formData: FormData,
): Promise<ActionResult<Group>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = createGroupSchema.safeParse({
      parentId: formData.get("parentId"),
      name: formData.get("name"),
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return createGroup(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath(`/grup/${result.data.parentId}`);
    revalidatePath("/grup");
  }
  return result;
}

export async function renameGroupAction(
  _prevState: ActionResult<Group> | null,
  formData: FormData,
): Promise<ActionResult<Group>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = renameGroupSchema.safeParse({
      groupId: formData.get("groupId"),
      name: formData.get("name"),
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return renameGroup(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath(`/grup/${result.data.id}`);
    revalidatePath("/grup");
  }
  return result;
}

/** Redirects to the parent group (or the tree root) on success, so it never resolves to `{ ok: true }`. */
export async function deleteGroupAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const session = await requireSession();
  return runAction(async () => {
    const parsed = deleteGroupSchema.safeParse({ groupId: formData.get("groupId") });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    const deleted = await deleteGroup(session, parsed.data.groupId);
    revalidatePath("/grup");
    if (deleted.parentId) revalidatePath(`/grup/${deleted.parentId}`);
    redirect(deleted.parentId ? `/grup/${deleted.parentId}` : "/grup");
  });
}

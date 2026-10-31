"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-session";
import { TAG_DEFAULT_COLOR } from "@/lib/constants";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import {
  attachActivityTag,
  attachMemberTag,
  detachActivityTag,
  detachMemberTag,
  type AttachResult,
  type DetachResult,
} from "@/lib/tag/assign";
import { createTag } from "@/lib/tag/mutations";
import { idSchema } from "@/lib/validation/common";
import { createTagSchema, tagTargetSchema, type TagTarget } from "@/lib/validation/tag";

function parseTarget(input: unknown): TagTarget {
  const parsed = tagTargetSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data tidak valid");
  return parsed.data;
}

function parseTagId(input: unknown): number {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data tidak valid");
  return parsed.data;
}

/** Detail page of the tagged entity plus its list, which show the chips. */
function revalidateTarget(target: TagTarget) {
  if (target.kind === "member") {
    revalidatePath("/dashboard/anggota");
    revalidatePath(`/dashboard/anggota/${target.id}`);
  } else {
    revalidatePath("/dashboard/kegiatan");
    revalidatePath(`/dashboard/kegiatan/${target.id}`);
  }
}

function attach(session: Awaited<ReturnType<typeof requireSession>>, target: TagTarget, tagId: number) {
  return target.kind === "member"
    ? attachMemberTag(session, { memberId: target.id, tagId })
    : attachActivityTag(session, { activityId: target.id, tagId });
}

/** `input` is `{ kind, id, tagId }` from the picker; every id is re-resolved and scope-checked in `lib/tag/assign`. */
export async function attachTagAction(input: unknown): Promise<ActionResult<AttachResult>> {
  const session = await requireSession();
  let target: TagTarget | undefined;
  const result = await runAction(async () => {
    target = parseTarget(input);
    return attach(session, target, parseTagId((input as { tagId?: unknown }).tagId));
  });
  if (result.ok && target && result.data.changed) revalidateTarget(target);
  return result;
}

export async function detachTagAction(input: unknown): Promise<ActionResult<DetachResult>> {
  const session = await requireSession();
  let target: TagTarget | undefined;
  const result = await runAction(async () => {
    target = parseTarget(input);
    const tagId = parseTagId((input as { tagId?: unknown }).tagId);
    return target.kind === "member"
      ? detachMemberTag(session, { memberId: target.id, tagId })
      : detachActivityTag(session, { activityId: target.id, tagId });
  });
  if (result.ok && target && result.data.changed) revalidateTarget(target);
  return result;
}

/**
 * "Buat tag" in the picker: creates the tag in the caller's own group (default color) and attaches it.
 * Two transactions, not one: if the attach is refused (e.g. the per-entity cap) the new tag still exists.
 */
export async function createAndAttachTagAction(
  input: unknown,
): Promise<ActionResult<{ tag: Awaited<ReturnType<typeof createTag>> } & AttachResult>> {
  const session = await requireSession();
  let target: TagTarget | undefined;
  const result = await runAction(async () => {
    target = parseTarget(input);
    const parsed = createTagSchema.safeParse({
      input: (input as { name?: unknown }).name,
      color: TAG_DEFAULT_COLOR,
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    const tag = await createTag(session, parsed.data);
    return { tag, ...(await attach(session, target, tag.id)) };
  });
  if (result.ok && target) revalidateTarget(target);
  return result;
}

"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-session";
import { TAG_DEFAULT_COLOR } from "@/lib/constants";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import {
  attachActivityTag,
  attachMemberTag,
  bulkTagMembers,
  detachActivityTag,
  detachMemberTag,
  type AttachResult,
  type BulkResult,
  type DetachResult,
} from "@/lib/tag/assign";
import {
  createTag,
  deleteTag,
  deleteTagKey,
  recolorTag,
  renameTagKey,
  renameTagValue,
} from "@/lib/tag/mutations";
import { idSchema } from "@/lib/validation/common";
import {
  bulkTagMembersSchema,
  createTagSchema,
  deleteTagSchema,
  recolorTagSchema,
  renameKeySchema,
  renameValueSchema,
  tagTargetSchema,
  type TagTarget,
} from "@/lib/validation/tag";

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

/**
 * Adds or removes one tag on the selected members of the current page. `lib/tag/assign` resolves and
 * checks every id and rejects the whole batch if any one fails.
 */
export async function bulkTagMembersAction(input: unknown): Promise<ActionResult<BulkResult>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = bulkTagMembersSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    return bulkTagMembers(session, parsed.data);
  });
  if (result.ok && result.data.changed > 0) revalidatePath("/dashboard/anggota");
  return result;
}

/** Tag management (group Tag tab). Everything is re-resolved and checked in `lib/tag/mutations` (403 unless ADMIN+ of the owner group). */
async function manage<T extends { groupId: number }>(
  run: (session: Awaited<ReturnType<typeof requireSession>>) => Promise<T | T[]>,
): Promise<ActionResult<T | T[]>> {
  const session = await requireSession();
  const result = await runAction(() => run(session));
  if (result.ok) {
    const rows = Array.isArray(result.data) ? result.data : [result.data];
    revalidatePath(`/dashboard/grup/${rows[0]?.groupId ?? session.groupId}`);
    // Chips, pickers and filters elsewhere show tag names and colors.
    revalidatePath("/dashboard/anggota");
    revalidatePath("/dashboard/kegiatan");
  }
  return result;
}

type Parsed<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: { message: string; path: PropertyKey[] }[] } };

/** Validates the client payload; a bad id gets the generic message, anything else its own (e.g. "Warna tidak valid"). */
function parseWith<T>(schema: { safeParse: (input: unknown) => Parsed<T> }, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw new ValidationError(!issue || issue.path.includes("tagId") ? "Data tidak valid" : issue.message);
}

/** `{ name: "key" | "key:value", color }`; the owner is always the caller's own group. */
export async function createTagAction(input: unknown) {
  const raw = (input ?? {}) as { name?: unknown; color?: unknown };
  return manage((session) => createTag(session, parseWith(createTagSchema, { input: raw.name, color: raw.color })));
}

export async function recolorTagAction(input: unknown) {
  return manage((session) => recolorTag(session, parseWith(recolorTagSchema, input)));
}

export async function renameTagKeyAction(input: unknown) {
  return manage((session) => renameTagKey(session, parseWith(renameKeySchema, input)));
}

export async function renameTagValueAction(input: unknown) {
  return manage((session) => renameTagValue(session, parseWith(renameValueSchema, input)));
}

export async function deleteTagAction(input: unknown) {
  return manage((session) => deleteTag(session, parseWith(deleteTagSchema, input)));
}

/** Deletes the tag's whole key: every value in the owner group. */
export async function deleteTagKeyAction(input: unknown) {
  return manage((session) => deleteTagKey(session, parseWith(deleteTagSchema, input)));
}

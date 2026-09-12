"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Member } from "@/lib/generated/prisma/client";
import { createMember, deleteMember, updateMember } from "@/lib/member/mutations";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import {
  createMemberSchema,
  deleteMemberSchema,
  updateMemberSchema,
} from "@/lib/validation/member";

async function requireSession() {
  const session = await auth();
  if (!session) redirect("/login");
  return session.user;
}

/**
 * `input` arrives as the plain object react-hook-form validated client-side
 * (DESIGN.md §4.2/§3.1: the client's validation is a UX convenience, never
 * trusted — the same zod schema is re-run here against the raw value).
 */
export async function createMemberAction(input: unknown): Promise<ActionResult<Member>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = createMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return createMember(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/anggota");
    revalidatePath(`/grup/${result.data.groupId}`);
  }
  return result;
}

export async function updateMemberAction(input: unknown): Promise<ActionResult<Member>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = updateMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return updateMember(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/anggota");
    revalidatePath(`/anggota/${result.data.id}`);
    revalidatePath(`/grup/${result.data.groupId}`);
  }
  return result;
}

/** Redirects to `/anggota` on success, so it never resolves to `{ ok: true }`. */
export async function deleteMemberAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const session = await requireSession();
  return runAction(async () => {
    const parsed = deleteMemberSchema.safeParse({ memberId: formData.get("memberId") });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    const deleted = await deleteMember(session, parsed.data.memberId);
    revalidatePath("/anggota");
    revalidatePath(`/grup/${deleted.groupId}`);
    redirect("/anggota");
  });
}

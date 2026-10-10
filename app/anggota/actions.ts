"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/require-session";
import type { Member } from "@/lib/generated/prisma/client";
import { MEMBER_COLUMNS, MEMBER_COLUMNS_COOKIE, serializeMemberColumns } from "@/lib/member/columns";
import { createMember, deleteMember, updateMember } from "@/lib/member/mutations";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import {
  createMemberSchema,
  deleteMemberSchema,
  updateMemberSchema,
} from "@/lib/validation/member";

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

/**
 * Saves which optional `/anggota` table columns the viewer wants. A UI
 * preference, not domain data, so it lives in a cookie and is not audited;
 * values are re-validated on every read (`parseMemberColumns`). Setting a
 * cookie in a Server Action refreshes the current route, so the table
 * re-renders with the new columns.
 */
export async function setMemberColumnsAction(formData: FormData): Promise<void> {
  await requireSession();
  const chosen = formData.getAll("kolom").filter((v): v is string => typeof v === "string");
  const columns = MEMBER_COLUMNS.map((c) => c.key).filter((key) => chosen.includes(key));
  (await cookies()).set(MEMBER_COLUMNS_COOKIE, serializeMemberColumns(columns), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

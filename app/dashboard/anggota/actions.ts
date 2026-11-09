"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/require-session";
import type { Member, MemberRelation } from "@/lib/generated/prisma/client";
import { MEMBER_COLUMNS, MEMBER_COLUMNS_COOKIE, serializeMemberColumns } from "@/lib/member/columns";
import { createMember, deleteMember, updateMember } from "@/lib/member/mutations";
import { linkMembers, unlinkMembers } from "@/lib/member/relation-mutations";
import { searchRelativeCandidates } from "@/lib/member/relation-queries";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import {
  createMemberSchema,
  deleteMemberSchema,
  updateMemberSchema,
} from "@/lib/validation/member";
import { linkMembersSchema, searchRelativeCandidatesSchema, unlinkMembersSchema } from "@/lib/validation/member-relation";

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
    revalidatePath("/dashboard/anggota");
    revalidatePath(`/dashboard/grup/${result.data.groupId}`);
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
    revalidatePath("/dashboard/anggota");
    revalidatePath(`/dashboard/anggota/${result.data.id}`);
    revalidatePath(`/dashboard/grup/${result.data.groupId}`);
  }
  return result;
}

function revalidateRelation(relation: Pick<MemberRelation, "fromMemberId" | "toMemberId">) {
  revalidatePath(`/dashboard/anggota/${relation.fromMemberId}`);
  revalidatePath(`/dashboard/anggota/${relation.toMemberId}`);
}

/** Links two members as family (member-relations spec); both ids are resolved and scope-checked server-side. */
export async function linkMembersAction(input: unknown): Promise<ActionResult<MemberRelation>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = linkMembersSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return linkMembers(session, parsed.data);
  });
  if (result.ok) revalidateRelation(result.data);
  return result;
}

export async function unlinkMembersAction(input: unknown): Promise<ActionResult<null>> {
  const session = await requireSession();
  return runAction(async () => {
    const parsed = unlinkMembersSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    revalidateRelation(await unlinkMembers(session, parsed.data));
    return null;
  });
}

/** Add-dialog picker (member-relations spec "Choosing a relative"); read-only, scope-filtered server-side. */
export async function searchRelativeCandidatesAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof searchRelativeCandidates>>>> {
  const session = await requireSession();
  return runAction(async () => {
    const parsed = searchRelativeCandidatesSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return searchRelativeCandidates(session, parsed.data.memberId, parsed.data.query);
  });
}

/** Redirects to `/dashboard/anggota` on success, so it never resolves to `{ ok: true }`. */
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
    revalidatePath("/dashboard/anggota");
    revalidatePath(`/dashboard/grup/${deleted.groupId}`);
    redirect("/dashboard/anggota");
  });
}

/**
 * Saves which optional `/dashboard/anggota` table columns the viewer wants. A UI
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

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { changePassword } from "@/lib/auth/change-password";
import { passwordSchema } from "@/lib/validation/auth";

const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type ChangePasswordState = { error: string | null };

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session) redirect("/login");

  const parsed = changePasswordFormSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const result = await changePassword(
    Number(session.user.id),
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/");
}

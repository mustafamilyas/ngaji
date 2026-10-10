"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { signOut } from "@/auth";
import { requireSession } from "@/lib/auth/require-session";
import { changePassword } from "@/lib/auth/change-password";
import { getClientIp } from "@/lib/http";
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
  const session = await requireSession({ allowPasswordChange: true });

  const parsed = changePasswordFormSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const requestHeaders = await headers();
  const result = await changePassword(
    Number(session.id),
    parsed.data.currentPassword,
    parsed.data.newPassword,
    {
      ip: getClientIp({ headers: requestHeaders } as Request),
      userAgent: requestHeaders.get("user-agent"),
    },
  );
  if (!result.ok) {
    return { error: result.error };
  }

  // sessionVersion was bumped, so this session (and any other device) is dead
  // anyway; sign out explicitly and tell the user why on the login page.
  await signOut({ redirectTo: "/login?pesan=password-diubah" });
  return { error: null };
}

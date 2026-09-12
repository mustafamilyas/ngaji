"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Level } from "@/lib/generated/prisma/client";
import { renameLevel } from "@/lib/group/levels";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import { renameLevelSchema } from "@/lib/validation/level";

export async function renameLevelAction(
  _prevState: ActionResult<Level> | null,
  formData: FormData,
): Promise<ActionResult<Level>> {
  const session = await auth();
  if (!session) redirect("/login");

  const result = await runAction(async () => {
    const parsed = renameLevelSchema.safeParse({
      depth: formData.get("depth"),
      name: formData.get("name"),
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return renameLevel(session.user, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/pengaturan/jenjang");
    revalidatePath("/grup");
  }
  return result;
}

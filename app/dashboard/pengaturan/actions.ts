"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-session";
import type { Organization } from "@/lib/generated/prisma/client";
import { type ActionResult, runAction } from "@/lib/errors";
import { updateOrganization } from "@/lib/organization/update";

/** Only `name` and `timezone` are read from the form; the organization always comes from the session. */
export async function updateOrganizationAction(
  _prevState: ActionResult<Organization> | null,
  formData: FormData,
): Promise<ActionResult<Organization>> {
  const user = await requireSession();
  const result = await runAction(() =>
    updateOrganization(user, {
      name: String(formData.get("name") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
    }),
  );
  // The name shows in the sidebar, titles and print header; the timezone moves "today" on every page.
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { getLevels } from "@/lib/group/levels";
import { RenameLevelForm } from "./rename-level-form";

/** DESIGN.md §3.2/§3.5: only an OWNER whose own group is the org's root. */
function isRootOwner(session: SessionUser): boolean {
  return session.role === "OWNER" && session.groupPath.split("/").filter(Boolean).length === 1;
}

export default async function LevelSettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (!isRootOwner(session.user)) {
    return (
      <div className="py-10">
        <p className="text-sm text-muted-foreground">Anda tidak memiliki izin mengakses halaman ini.</p>
      </div>
    );
  }

  const ownGroup = await db.group.findUnique({
    where: { id: session.user.groupId },
    select: { organizationId: true },
  });
  const levels = ownGroup ? await getLevels(ownGroup.organizationId) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Jenjang</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ganti nama jenjang organisasi.</p>
      </div>
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <RenameLevelForm key={level.id} depth={level.depth} name={level.name} />
        ))}
      </div>
    </div>
  );
}

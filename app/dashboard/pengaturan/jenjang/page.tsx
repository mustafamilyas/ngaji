import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex flex-col gap-6">
        <PageHeader breadcrumb={[{ label: "Pengaturan" }, { label: "Jenjang" }]} title="Jenjang" />
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          Anda tidak memiliki izin mengakses halaman ini.
        </p>
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
      <PageHeader breadcrumb={[{ label: "Pengaturan" }, { label: "Jenjang" }]} title="Jenjang" meta="Nama tiap tingkat organisasi, dari pusat sampai grup daun." />
      <Card>
        <CardHeader>
          <CardTitle>Nama jenjang</CardTitle>
          <CardDescription>
            Jumlah jenjang tetap; hanya namanya yang bisa diganti. Nama baru langsung dipakai di seluruh aplikasi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col divide-y">
            {levels.map((level) => (
              <li key={level.id} className="py-3 first:pt-0 last:pb-0">
                <RenameLevelForm depth={level.depth} name={level.name} />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

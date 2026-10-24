import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isRootOwner } from "@/lib/auth/session-user";
import { getLevels } from "@/lib/group/levels";
import { getOrganization } from "@/lib/organization";
import { OrganizationForm } from "./organization-form";
import { RenameLevelForm } from "./rename-level-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (!isRootOwner(session.user)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader breadcrumb={[{ label: "Pengaturan" }]} title="Pengaturan" />
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          Anda tidak memiliki izin mengakses halaman ini.
        </p>
      </div>
    );
  }

  const [organization, levels] = await Promise.all([
    getOrganization(session),
    getLevels(session.user.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader breadcrumb={[{ label: "Pengaturan" }]} title="Pengaturan" meta="Pengaturan organisasi dan nama jenjang." />
      <Card>
        <CardHeader>
          <CardTitle>Organisasi</CardTitle>
          <CardDescription>Nama tampil di menu, judul halaman, dan cetakan.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm name={organization.name} timezone={organization.timeZone} />
        </CardContent>
      </Card>
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

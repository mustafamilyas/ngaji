import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listLeafGroupsInScope } from "@/lib/group/levels";
import { ImportForm } from "./import-form";

export default async function ImportMembersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const leafGroups = await listLeafGroupsInScope(session.user);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: "Anggota", href: "/dashboard/anggota" }, { label: "Impor CSV" }]}
        title="Impor anggota dari CSV"
      />
      <Card>
        <CardContent>
          <ImportForm leafGroups={leafGroups.map((g) => ({ id: g.id, name: g.name, parentName: g.parent?.name }))} />
        </CardContent>
      </Card>
    </div>
  );
}

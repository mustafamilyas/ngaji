import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityForm } from "../activity-form";

export default async function NewActivityPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: "Kegiatan", href: "/kegiatan" }, { label: "Kegiatan baru" }]}
        title="Kegiatan baru"
        meta="Kegiatan ini akan dimiliki oleh grup Anda dan berlaku untuk semua turunannya."
      />
      <Card>
        <CardContent>
          <ActivityForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}

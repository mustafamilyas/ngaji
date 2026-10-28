import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { adminGroupIds } from "@/lib/authz";
import { today } from "@/lib/dates";
import { db } from "@/lib/db";
import { ActivityForm } from "../activity-form";

export default async function NewActivityPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Own group first, then the additional ADMIN roles (DESIGN.md §3.2a); a group the user lost access to is simply absent.
  const ids = adminGroupIds(session.user);
  const found = await db.group.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, name: true, parent: { select: { name: true } } },
  });
  const ownerGroups = ids
    .map((id) => found.find((g) => g.id === id))
    .filter((g) => g !== undefined)
    .map((g) => ({ id: g.id, name: g.name, parentName: g.parent?.name }));
  if (ownerGroups.length === 0) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: "Kegiatan", href: "/dashboard/kegiatan" }, { label: "Kegiatan baru" }]}
        title="Kegiatan baru"
        meta="Kegiatan dimiliki oleh grup yang Anda pilih dan berlaku untuk semua turunannya."
      />
      <Card>
        <CardContent>
          <ActivityForm mode="create" today={today(session.user.timeZone)} ownerGroups={ownerGroups} />
        </CardContent>
      </Card>
    </div>
  );
}

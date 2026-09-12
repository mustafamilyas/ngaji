import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ActivityForm } from "../activity-form";

export default async function NewActivityPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Kegiatan baru</h1>
      <p className="text-sm text-muted-foreground">
        Kegiatan ini akan dimiliki oleh grup Anda dan berlaku untuk semua turunannya.
      </p>
      <ActivityForm mode="create" />
    </div>
  );
}

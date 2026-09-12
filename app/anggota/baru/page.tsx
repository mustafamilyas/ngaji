import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listLeafGroupsInScope } from "@/lib/group/levels";
import { MemberForm } from "../member-form";

export default async function NewMemberPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const leafGroups = await listLeafGroupsInScope(session.user);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Anggota baru</h1>
      <MemberForm mode="create" leafGroups={leafGroups} />
    </div>
  );
}

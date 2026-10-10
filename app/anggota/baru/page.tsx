import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listLeafGroupsInScope } from "@/lib/group/levels";
import { MemberForm } from "../member-form";

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const [leafGroups, query] = await Promise.all([listLeafGroupsInScope(session.user), searchParams]);
  // `?grup=` (from a group page) only preselects; it must be one of the in-scope leaves listed above.
  const requested = typeof query.grup === "string" ? Number(query.grup) : undefined;
  const initialGroupId = leafGroups.some((g) => g.id === requested) ? requested : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: "Anggota", href: "/anggota" }, { label: "Anggota baru" }]}
        title="Anggota baru"
      />
      <Card>
        <CardContent>
          <MemberForm mode="create" leafGroups={leafGroups} initialGroupId={initialGroupId} />
        </CardContent>
      </Card>
    </div>
  );
}

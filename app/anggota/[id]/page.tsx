import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { attendanceHistoryForMember } from "@/lib/attendance/history";
import { NotFoundError } from "@/lib/errors";
import { resolveMember } from "@/lib/resolve";
import type { MemberFormValues } from "@/lib/validation/member";
import { DeleteMemberForm } from "./delete-member-form";
import { MemberForm } from "../member-form";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) notFound();

  const session = await auth();
  if (!session) redirect("/login");

  let member;
  try {
    member = await resolveMember(session.user, memberId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const history = await attendanceHistoryForMember(member.id);

  const defaultValues: MemberFormValues = {
    name: member.name,
    birthPlace: member.birthPlace,
    birthDate: member.birthDate,
    sex: member.sex as MemberFormValues["sex"],
    address: member.address,
    phone: member.phone,
    maritalStatus: member.maritalStatus as MemberFormValues["maritalStatus"],
    workStatus: member.workStatus as MemberFormValues["workStatus"],
    email: member.email ?? undefined,
    status: member.status as MemberFormValues["status"],
    joinedAt: member.joinedAt,
    exitedAt: member.exitedAt ?? undefined,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-muted-foreground">{member.group.name}</p>
        <h1 className="text-lg font-semibold">{member.name}</h1>
      </div>

      <MemberForm mode="edit" memberId={member.id} defaultValues={defaultValues} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Riwayat kehadiran</h2>
        {history.length > 0 ? (
          <ul className="flex flex-col divide-y text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between py-2">
                <span>{entry.activityName}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.effectiveDate} · {entry.status === "HADIR" ? "Hadir" : "Izin"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada riwayat kehadiran.</p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-md border p-3">
        <h2 className="text-sm font-medium">Hapus anggota</h2>
        <DeleteMemberForm memberId={member.id} />
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck, CalendarDays, Network, Pencil, Phone, User } from "lucide-react";
import { auth } from "@/auth";
import { DangerZone, DangerZoneItem } from "@/components/danger-zone";
import { MemberStatusBadge } from "@/components/member-status-badge";
import { MetaItem, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { TabNav } from "@/components/tab-nav";
import { buttonVariants } from "@/components/ui/button";
import { touchLgButton } from "@/components/ui/touch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { attendanceHistoryForMember } from "@/lib/attendance/history";
import { ageInYears, today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { formatDate, parsePage } from "@/lib/filters";
import { groupTrail } from "@/lib/group/trail";
import { formatEnumLabel, SEX_LABELS } from "@/lib/member/labels";
import { pageHref } from "@/lib/pagination";
import { resolveMember } from "@/lib/resolve";
import { parseTab, tabHref } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import type { Sex } from "@/lib/validation/enums";
import type { MemberFormValues } from "@/lib/validation/member";
import { DeleteMemberForm } from "./delete-member-form";
import { MemberForm } from "../member-form";

const TABS = ["profil", "kehadiran", "ubah"] as const;

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
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

  const tab = parseTab(query.tab, TABS, "profil");
  const path = `/dashboard/anggota/${member.id}`;
  const [history, trail] = await Promise.all([
    attendanceHistoryForMember(member.id, parsePage(query.riwayat)),
    groupTrail(session.user.groupPath, member.group.path),
  ]);
  // The leaf and its parent are enough to place a member; the full chain is on the group page.
  const groupCrumbs = trail.slice(-2);

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
      <PageHeader
        breadcrumb={[{ label: "Anggota", href: "/dashboard/anggota" }, { label: member.name }]}
        title={member.name}
        badges={<MemberStatusBadge status={member.status} />}
        meta={
          <>
            <MetaItem icon={Network}>
              {groupCrumbs.map((g, i) => (
                <span key={g.id}>
                  {i > 0 && " › "}
                  {g.href ? (
                    <Link href={g.href} className="inline-flex min-h-11 items-center hover:text-foreground hover:underline xl:min-h-0">
                      {g.name}
                    </Link>
                  ) : (
                    g.name
                  )}
                </span>
              ))}
            </MetaItem>
            <MetaItem icon={Phone}>{member.phone}</MetaItem>
            <MetaItem icon={CalendarDays}>Masuk {formatDate(member.joinedAt)}</MetaItem>
          </>
        }
        actions={
          <>
            {tab !== "ubah" && (
              <Link href={tabHref(path, "ubah", "profil")} className={cn(buttonVariants({ variant: "outline", size: "lg" }), touchLgButton)}>
                <Pencil />
                Ubah data
              </Link>
            )}
            <WhatsAppButton phone={member.phone} name={member.name} />
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <TabNav
          path={path}
          current={tab}
          defaultTab="profil"
          tabs={[
            { key: "profil", label: "Profil", icon: User },
            { key: "kehadiran", label: "Kehadiran", icon: CalendarCheck, count: history.total },
            { key: "ubah", label: "Ubah", icon: Pencil },
          ]}
        />

        {tab === "profil" && (
          <Card>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Detail label="Jenis kelamin">{SEX_LABELS[member.sex as Sex] ?? member.sex}</Detail>
                <Detail label="Tempat, tanggal lahir">
                  {member.birthPlace}, {formatDate(member.birthDate)}
                  <span className="text-muted-foreground"> · {ageInYears(member.birthDate, today(session.user.timeZone))} th</span>
                </Detail>
                <Detail label="Status nikah">{formatEnumLabel(member.maritalStatus)}</Detail>
                <Detail label="Pekerjaan">{formatEnumLabel(member.workStatus)}</Detail>
                <Detail label="No. HP">{member.phone}</Detail>
                <Detail label="Email">{member.email ?? <span className="text-muted-foreground">—</span>}</Detail>
                <Detail label="Alamat" wide>
                  {member.address}
                </Detail>
                <Detail label="Tanggal masuk">{formatDate(member.joinedAt)}</Detail>
                {member.exitedAt && <Detail label="Tanggal keluar">{formatDate(member.exitedAt)}</Detail>}
              </dl>
            </CardContent>
          </Card>
        )}

        {tab === "kehadiran" && (
          <Card>
            <CardHeader>
              <CardTitle>Riwayat kehadiran</CardTitle>
              <CardDescription>Kegiatan yang tercatat hadir atau izin, terbaru di atas.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {history.entries.length > 0 ? (
                <ul className="flex flex-col divide-y">
                  {history.entries.map((entry) => (
                    <li key={entry.id}>
                      <Link
                        href={`/dashboard/kegiatan/${entry.activityId}/${entry.date}`}
                        className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{entry.activityName}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(entry.effectiveDate)}</p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            entry.status === "HADIR"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                          )}
                        >
                          {entry.status === "HADIR" ? "Hadir" : "Izin"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">Belum ada riwayat kehadiran.</p>
              )}
              <Pagination
                page={history.page}
                pageSize={history.pageSize}
                total={history.total}
                scroll={false}
                hrefFor={(target) => pageHref(path, query, target, "riwayat")}
              />
            </CardContent>
          </Card>
        )}

        {tab === "ubah" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Data anggota</CardTitle>
                <CardDescription>Perubahan tercatat di log audit.</CardDescription>
              </CardHeader>
              <CardContent>
                <MemberForm mode="edit" memberId={member.id} defaultValues={defaultValues} />
              </CardContent>
            </Card>

            <DangerZone>
              <DangerZoneItem
                title="Hapus anggota"
                description="Anggota disembunyikan dari daftar dan statistik; riwayat kehadirannya tetap tersimpan."
              >
                <DeleteMemberForm memberId={member.id} />
              </DangerZoneItem>
            </DangerZone>
          </>
        )}
      </div>
    </div>
  );
}

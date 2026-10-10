import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Clock, Info, MapPin, Network, UserCheck, type LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { MetaItem, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import { checkInPath } from "@/lib/attendance/paths";
import { toActivityTemplate } from "@/lib/activity/template";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { formatDate } from "@/lib/filters";
import { getMaxDepth } from "@/lib/group/levels";
import { resolveActivity, resolveGroup } from "@/lib/resolve";
import { isInScope } from "@/lib/scope";
import { expected } from "@/lib/stats";
import type { MemberStatus } from "@/lib/validation/enums";
import { AttendanceForm } from "./attendance-form";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function Notice({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tanggal: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, tanggal } = await params;
  const activityId = Number(id);
  if (!Number.isInteger(activityId) || !DATE_RE.test(tanggal)) notFound();

  const session = await auth();
  if (!session) redirect("/login");

  let activity;
  try {
    activity = await resolveActivity(session.user, activityId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const rows = await loadOccurrenceRows(activity.id, tanggal, tanggal);
  const occurrence = occurrencesFor(toActivityTemplate(activity), tanggal, tanggal, rows).find(
    (o) => o.key === tanggal,
  );
  if (!occurrence) notFound();

  const isCancelled = occurrence.status === "CANCELLED";
  const isFuture = occurrence.effectiveDate > today();
  const moved = occurrence.effectiveDate !== occurrence.key;
  const activityHref = `/kegiatan/${activity.id}`;

  const header = (groupName: string, actions?: React.ReactNode) => (
    <PageHeader
      breadcrumb={[
        { label: "Kegiatan", href: "/kegiatan" },
        { label: activity.name, href: activityHref },
        { label: formatDate(occurrence.effectiveDate) },
      ]}
      title={activity.name}
      badges={
        <>
          {isCancelled && <Badge variant="destructive">Batal</Badge>}
          {moved && <Badge variant="outline">Dipindah dari {formatDate(occurrence.key)}</Badge>}
        </>
      }
      meta={
        <>
          <MetaItem icon={CalendarDays}>{formatDate(occurrence.effectiveDate)}</MetaItem>
          <MetaItem icon={Clock}>
            {occurrence.effectiveStartTime} · {occurrence.effectiveDurationMinutes} menit
          </MetaItem>
          <MetaItem icon={MapPin}>{occurrence.effectiveLocation}</MetaItem>
          <MetaItem icon={Network}>{groupName}</MetaItem>
        </>
      }
      actions={actions}
    />
  );

  // DESIGN.md §3.3: a user above the activity's own group can view attendance
  // but never record it — show the whole subtree read-only instead of the
  // single-leaf recording form below.
  const canRecordHere = isInScope(session.user.groupPath, activity.group.path);
  if (!canRecordHere) {
    const members = await db.member.findMany({
      where: { group: { path: { startsWith: activity.group.path } } },
      orderBy: { name: "asc" },
    });
    const expectedMembers = expected(
      { effectiveDate: occurrence.effectiveDate },
      members.map((m) => ({ ...m, status: m.status as MemberStatus })),
    );

    const occurrenceRow = await db.activityOccurrence.findUnique({
      where: { activityId_date: { activityId: activity.id, date: tanggal } },
      include: { attendances: true },
    });
    const attendanceByMember = new Map(
      (occurrenceRow?.attendances ?? []).map((a) => [a.memberId, a.status as "HADIR" | "IZIN"]),
    );

    return (
      <div className="flex flex-col gap-6">
        {header(activity.group.name)}
        <Notice icon={Info}>
          Kegiatan ini diwarisi dari {activity.group.name}. Anda bisa melihat, tetapi tidak bisa mengisi absensi di
          sini karena tidak berada di grup pemiliknya atau di bawahnya.
        </Notice>

        <Card>
          <CardContent>
            <AttendanceForm
              activityId={activity.id}
              groupId={activity.groupId}
              date={tanggal}
              readOnly
              members={expectedMembers.map((member) => ({
                id: member.id,
                name: member.name,
                current: attendanceByMember.get(member.id),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const query = await searchParams;
  const maxDepth = await getMaxDepth(activity.group.organizationId);

  let leafGroup: { id: number; path: string; name: string; depth: number } | null = null;
  const grupParam = typeof query.grup === "string" ? Number(query.grup) : undefined;
  if (grupParam !== undefined) {
    try {
      const resolved = await resolveGroup(session.user, grupParam);
      if (resolved.depth === maxDepth) leafGroup = resolved;
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
  if (!leafGroup) {
    const own = await db.group.findUnique({ where: { id: session.user.groupId } });
    if (own && own.depth === maxDepth) leafGroup = own;
  }

  // No fixed group to record for: the check-in page lets the user pick one (and their name) in a single step.
  if (!leafGroup) redirect(checkInPath(activity.id, tanggal));

  const isFutureOrCancelled = isCancelled || isFuture;

  const members = await db.member.findMany({ where: { groupId: leafGroup.id }, orderBy: { name: "asc" } });
  const expectedMembers = expected(
    { effectiveDate: occurrence.effectiveDate },
    members.map((m) => ({ ...m, status: m.status as MemberStatus })),
  );

  const occurrenceRow = await db.activityOccurrence.findUnique({
    where: { activityId_date: { activityId: activity.id, date: tanggal } },
    include: { attendances: true },
  });
  const attendanceByMember = new Map(
    (occurrenceRow?.attendances ?? []).map((a) => [a.memberId, a.status as "HADIR" | "IZIN"]),
  );

  return (
    <div className="flex flex-col gap-6">
      {header(
        leafGroup.name,
        <Link href={checkInPath(activity.id, tanggal)} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <UserCheck />
          Mode check-in
        </Link>,
      )}
      {isFuture && !isCancelled && (
        <Notice icon={Info}>Tanggal ini belum terjadi; absensi belum bisa diisi.</Notice>
      )}

      <Card>
        <CardContent>
          <AttendanceForm
            activityId={activity.id}
            groupId={leafGroup.id}
            date={tanggal}
            readOnly={isFutureOrCancelled}
            members={expectedMembers.map((member) => ({
              id: member.id,
              name: member.name,
              current: attendanceByMember.get(member.id),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

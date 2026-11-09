import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Clock, Info, MapPin, Network, UserCheck, type LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { MetaItem, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import { checkInPath } from "@/lib/attendance/paths";
import { toActivityTemplate } from "@/lib/activity/template";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { canRecordFutureAttendance } from "@/lib/authz";
import { formatDate } from "@/lib/filters";
import { getMaxDepth } from "@/lib/group/levels";
import { resolveActivity } from "@/lib/resolve";
import { cn } from "@/lib/utils";
import { isInScope } from "@/lib/scope";
import { expected } from "@/lib/stats";
import type { AttendanceStatus, MemberStatus } from "@/lib/validation/enums";
import { AttendanceTable } from "./attendance-table";

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
  const isFuture = occurrence.effectiveDate > today(session.user.timeZone);
  const moved = occurrence.effectiveDate !== occurrence.key;
  const activityHref = `/dashboard/kegiatan/${activity.id}`;

  const header = (groupName: string, actions?: React.ReactNode) => (
    <PageHeader
      breadcrumb={[
        { label: "Kegiatan", href: "/dashboard/kegiatan" },
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
  // but never record it. Users at or below it see (and record for) the leaf
  // groups in their own scope; those above see the owning group's subtree.
  const canRecordHere = isInScope(session.user.groupPath, activity.group.path);
  const subtreePath = canRecordHere ? session.user.groupPath : activity.group.path;
  const editable =
    canRecordHere && !isCancelled && (!isFuture || canRecordFutureAttendance(session.user));

  const [maxDepth, query, occurrenceRow] = await Promise.all([
    getMaxDepth(activity.group.organizationId),
    searchParams,
    db.activityOccurrence.findUnique({
      where: { activityId_date: { activityId: activity.id, date: tanggal } },
      include: { attendances: true },
    }),
  ]);
  const members = await db.member.findMany({
    where: { group: { path: { startsWith: subtreePath }, depth: maxDepth } },
    include: { group: { select: { id: true, name: true } } },
  });
  const expectedMembers = expected(
    { effectiveDate: occurrence.effectiveDate },
    members.map((m) => ({ ...m, status: m.status as MemberStatus })),
  );
  const attendanceByMember = new Map((occurrenceRow?.attendances ?? []).map((a) => [a.memberId, a]));

  const groups = [...new Map(expectedMembers.map((m) => [m.group.id, m.group])).values()].sort((a, b) =>
    a.name.localeCompare(b.name, "id-ID"),
  );
  const grupParam = typeof query.grup === "string" ? Number(query.grup) : undefined;
  const initialGroupId = groups.some((g) => g.id === grupParam) ? grupParam : undefined;

  return (
    <div className="flex flex-col gap-6">
      {header(
        activity.group.name,
        canRecordHere && (
          <Link href={checkInPath(activity.id, tanggal)} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 w-full text-base sm:w-auto xl:h-9 xl:text-sm")}>
            <UserCheck />
            Mode check-in
          </Link>
        ),
      )}
      {!canRecordHere && (
        <Notice icon={Info}>
          Kegiatan ini diwarisi dari {activity.group.name}. Anda bisa melihat, tetapi tidak bisa mengisi absensi di
          sini karena tidak berada di grup pemiliknya atau di bawahnya.
        </Notice>
      )}
      {canRecordHere && isCancelled && <Notice icon={Info}>Kegiatan ini dibatalkan pada tanggal ini; absensi hanya bisa dilihat.</Notice>}
      {canRecordHere && isFuture && !isCancelled && (
        <Notice icon={Info}>
          {editable
            ? "Tanggal ini belum terjadi. Sebagai admin Anda tetap bisa mengisi absensi, misalnya izin yang sudah diketahui."
            : "Tanggal ini belum terjadi; absensi belum bisa diisi."}
        </Notice>
      )}

      <AttendanceTable
        activityId={activity.id}
        date={tanggal}
        editable={editable}
        groups={groups}
        initialGroupId={initialGroupId}
        rows={expectedMembers.map((member) => {
          const attendance = attendanceByMember.get(member.id);
          return {
            id: member.id,
            name: member.name,
            groupId: member.group.id,
            groupName: member.group.name,
            status: attendance?.status as AttendanceStatus | undefined,
            note: attendance?.note,
          };
        })}
      />
    </div>
  );
}

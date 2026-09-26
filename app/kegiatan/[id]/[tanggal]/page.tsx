import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import { toActivityTemplate } from "@/lib/activity/template";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { getMaxDepth, listLeafGroupsInScope } from "@/lib/group/levels";
import { resolveActivity, resolveGroup } from "@/lib/resolve";
import { isInScope } from "@/lib/scope";
import { expected } from "@/lib/stats";
import type { MemberStatus } from "@/lib/validation/enums";
import { AttendanceForm } from "./attendance-form";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {activity.group.name} · {occurrence.effectiveDate} · {occurrence.effectiveStartTime}
          </p>
          <h1 className="text-lg font-semibold">{activity.name}</h1>
          <p className="text-sm text-muted-foreground">
            Kegiatan ini diwarisi dari {activity.group.name}. Anda bisa melihat, tetapi tidak bisa mengisi
            absensi di sini karena tidak berada di grup pemiliknya atau di bawahnya.
          </p>
          {isCancelled && <p className="text-sm text-destructive">Kegiatan ini dibatalkan pada tanggal ini.</p>}
        </div>

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

  if (!leafGroup) {
    const leafOptions = await listLeafGroupsInScope(session.user);
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">{activity.name}</h1>
        <p className="text-sm text-muted-foreground">Pilih grup daun untuk mengisi absensi tanggal {tanggal}.</p>
        <form method="get" className="flex gap-2">
          <select
            name="grup"
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          >
            {leafOptions.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted">
            Pilih
          </button>
        </form>
      </div>
    );
  }

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
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted-foreground">
          {leafGroup.name} · {occurrence.effectiveDate} · {occurrence.effectiveStartTime}
        </p>
        <h1 className="text-lg font-semibold">{activity.name}</h1>
        {isCancelled && <p className="text-sm text-destructive">Kegiatan ini dibatalkan pada tanggal ini.</p>}
        {isFuture && !isCancelled && (
          <p className="text-sm text-muted-foreground">Tanggal ini belum terjadi; absensi belum bisa diisi.</p>
        )}
      </div>

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
    </div>
  );
}

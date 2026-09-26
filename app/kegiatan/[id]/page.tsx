import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { toActivityTemplate } from "@/lib/activity/template";
import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import { canEditActivity } from "@/lib/authz";
import { CONFLICT_HORIZON_DAYS, DEFAULT_STATS_RANGE_DAYS } from "@/lib/constants";
import { addDays, today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { resolveActivity } from "@/lib/resolve";
import { isInScope } from "@/lib/scope";
import { activityAttendanceSummary } from "@/lib/stats";
import { ActivityForm } from "../activity-form";
import { ActivityAttendanceChart } from "./attendance-chart";
import { DeleteActivityForm } from "./delete-activity-form";
import { EndActivityForm } from "./end-activity-form";
import { OccurrenceOverrideForm } from "./occurrence-override-form";

const WEEKDAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const activityId = Number(id);
  if (!Number.isInteger(activityId)) notFound();

  const session = await auth();
  if (!session) redirect("/login");

  const query = await searchParams;
  const showConflictWarning = query.conflict === "1";

  let activity;
  try {
    activity = await resolveActivity(session.user, activityId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const canEdit = canEditActivity(session.user, activity.groupId);
  const canRecord = isInScope(session.user.groupPath, activity.group.path);

  const from = today();
  const to = addDays(from, CONFLICT_HORIZON_DAYS);
  const rows = await loadOccurrenceRows(activity.id, from, to);
  const occurrences = occurrencesFor(toActivityTemplate(activity), from, to, rows);

  const attendanceSummary = await activityAttendanceSummary(
    activity.id,
    toActivityTemplate(activity),
    activity.group.path,
    { from: addDays(today(), -DEFAULT_STATS_RANGE_DAYS), to: today() },
  );

  const defaultValues = {
    name: activity.name,
    location: activity.location,
    notes: activity.notes ?? undefined,
    startTime: activity.startTime,
    durationMinutes: activity.durationMinutes,
    freq: activity.freq as "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY",
    interval: activity.interval,
    weekdays: activity.weekdays as number[],
    monthDay: activity.monthDay ?? undefined,
    startsOn: activity.startsOn,
    endsOn: activity.endsOn ?? undefined,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-muted-foreground">{activity.group.name}</p>
        <h1 className="text-lg font-semibold">{activity.name}</h1>
        <p className="text-sm text-muted-foreground">
          {activity.freq === "WEEKLY" &&
            `Mingguan · ${(activity.weekdays as number[]).map((d) => WEEKDAY_LABELS[d]).join(", ")}`}
          {activity.freq === "DAILY" && `Harian, tiap ${activity.interval} hari`}
          {activity.freq === "MONTHLY" && `Bulanan, tanggal ${activity.monthDay}`}
          {activity.freq === "ONCE" && "Sekali"}
          {" · "}
          {activity.startTime} ({activity.durationMinutes} menit) · {activity.location}
        </p>
      </div>

      {showConflictWarning && (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          Tersimpan, tetapi jadwal ini berkonflik dengan kegiatan lain dalam 90 hari ke depan.
        </p>
      )}

      {canEdit ? (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h2 className="text-sm font-medium">Ubah kegiatan</h2>
          <ActivityForm mode="edit" activityId={activity.id} defaultValues={defaultValues} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Kegiatan ini diwarisi dari {activity.group.name} dan hanya bisa diubah oleh grup pemiliknya.
        </p>
      )}

      {canEdit && (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h2 className="text-sm font-medium">Jadwal lanjutan</h2>
          {activity.freq !== "ONCE" && (
            <Link href={`/kegiatan/${activity.id}/geser`} className="text-sm text-primary hover:underline">
              Ubah ini &amp; seterusnya
            </Link>
          )}
          <EndActivityForm activityId={activity.id} />
          <DeleteActivityForm activityId={activity.id} />
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-md border p-3">
        <h2 className="text-sm font-medium">Absensi</h2>
        <ActivityAttendanceChart
          summary={attendanceSummary}
          rangeDays={DEFAULT_STATS_RANGE_DAYS}
          activityId={activity.id}
          canRecord={canRecord}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Jadwal ({occurrences.length})</h2>
        {occurrences.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {occurrences.map((occurrence) => (
              <li key={occurrence.key} className="flex flex-col gap-2 rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {occurrence.effectiveDate} · {occurrence.effectiveStartTime}
                    {occurrence.effectiveDate !== occurrence.key && (
                      <span className="ml-1 text-xs text-muted-foreground">(dipindah dari {occurrence.key})</span>
                    )}
                    {occurrence.status === "CANCELLED" && (
                      <span className="ml-1 text-xs text-destructive">batal</span>
                    )}
                  </span>
                  {canRecord && (
                    <Link
                      href={`/kegiatan/${activity.id}/${occurrence.key}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Isi absensi
                    </Link>
                  )}
                </div>
                {canEdit && (
                  <OccurrenceOverrideForm
                    activityId={activity.id}
                    occurrenceKey={occurrence.key}
                    isCancelled={occurrence.status === "CANCELLED"}
                    effectiveDate={occurrence.effectiveDate}
                    effectiveStartTime={occurrence.effectiveStartTime}
                    effectiveDurationMinutes={occurrence.effectiveDurationMinutes}
                    effectiveLocation={occurrence.effectiveLocation}
                    effectiveNotes={occurrence.effectiveNotes}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Tidak ada jadwal dalam 90 hari ke depan.</p>
        )}
      </section>
    </div>
  );
}

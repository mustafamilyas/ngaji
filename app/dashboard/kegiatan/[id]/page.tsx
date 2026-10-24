import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Info,
  MapPin,
  Network,
  Pencil,
  Repeat,
  Settings,
  TriangleAlert,
} from "lucide-react";
import { auth } from "@/auth";
import { DangerZone, DangerZoneItem } from "@/components/danger-zone";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar } from "@/components/filters/filter-bar";
import { MetaItem, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { TabNav, type TabItem } from "@/components/tab-nav";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { scheduleLabel, WEEKDAY_LABELS } from "@/lib/activity/labels";
import { toActivityTemplate } from "@/lib/activity/template";
import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import { canEditActivity } from "@/lib/authz";
import { CONFLICT_HORIZON_DAYS, EMBEDDED_PAGE_SIZE, STATS_DATE_RANGE } from "@/lib/constants";
import { addDays, today, weekdayOf } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { formatDate, parsePage, resolveDateRange } from "@/lib/filters";
import { pageHref, paginate } from "@/lib/pagination";
import { resolveActivity } from "@/lib/resolve";
import { isInScope } from "@/lib/scope";
import { activityAttendanceSummary } from "@/lib/stats";
import { parseTab, tabHref } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import { ActivityForm } from "../activity-form";
import { ActivityAttendanceChart } from "./attendance-chart";
import { DeleteActivityForm } from "./delete-activity-form";
import { EndActivityForm } from "./end-activity-form";
import { OccurrenceOverrideDialog } from "./occurrence-override-dialog";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";

const TABS = ["absensi", "jadwal", "pengaturan"] as const;
type Tab = (typeof TABS)[number];

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
  const path = `/dashboard/kegiatan/${activity.id}`;

  const now = today(DEFAULT_TIMEZONE);
  const scheduleTo = addDays(now, CONFLICT_HORIZON_DAYS);
  const rows = await loadOccurrenceRows(activity.id, now, scheduleTo);
  const occurrences = occurrencesFor(toActivityTemplate(activity), now, scheduleTo, rows);
  const todays = occurrences.find((o) => o.effectiveDate === now && o.status !== "CANCELLED");
  const ended = activity.endsOn !== null && activity.endsOn < now;

  const tabs: TabItem<Tab>[] = [
    { key: "absensi", label: "Absensi", icon: BarChart3 },
    { key: "jadwal", label: "Jadwal", icon: CalendarDays, count: occurrences.length },
    ...(canEdit ? [{ key: "pengaturan" as const, label: "Pengaturan", icon: Settings }] : []),
  ];
  const requested = parseTab(query.tab, TABS, "absensi");
  const tab = tabs.some((t) => t.key === requested) ? requested : "absensi";
  const attendance = tab === "absensi" ? await loadAttendance(activity, query, now) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: "Kegiatan", href: "/dashboard/kegiatan" }, { label: activity.name }]}
        title={activity.name}
        badges={
          <>
            {!canEdit && <Badge variant="secondary">Warisan</Badge>}
            {ended && <Badge variant="outline">Berakhir</Badge>}
          </>
        }
        meta={
          <>
            <MetaItem icon={Repeat}>{scheduleLabel(activity)}</MetaItem>
            <MetaItem icon={Clock}>
              {activity.startTime} · {activity.durationMinutes} menit
            </MetaItem>
            <MetaItem icon={MapPin}>{activity.location}</MetaItem>
            <MetaItem icon={Network}>
              {canRecord ? (
                <Link href={`/dashboard/grup/${activity.group.id}`} className="hover:text-foreground hover:underline">
                  {activity.group.name}
                </Link>
              ) : (
                activity.group.name
              )}
            </MetaItem>
          </>
        }
        actions={
          <>
            {canEdit && tab !== "pengaturan" && (
              <Link href={tabHref(path, "pengaturan", "absensi")} className={buttonVariants({ variant: "outline", size: "lg" })}>
                <Pencil />
                Ubah
              </Link>
            )}
            {canRecord && todays && (
              <Link href={`${path}/${todays.key}`} className={buttonVariants({ size: "lg" })}>
                <ClipboardCheck />
                Isi absensi hari ini
              </Link>
            )}
          </>
        }
      />

      {showConflictWarning && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Tersimpan, tetapi jadwal ini berkonflik dengan kegiatan lain dalam {CONFLICT_HORIZON_DAYS} hari ke depan.
        </p>
      )}
      {!canEdit && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          Kegiatan ini diwarisi dari {activity.group.name} dan hanya bisa diubah oleh grup pemiliknya.
        </p>
      )}
      {activity.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{activity.notes}</p>}

      <div className="flex flex-col gap-4">
        <TabNav path={path} tabs={tabs} current={tab} defaultTab="absensi" />

        {attendance && <AttendanceTab activityId={activity.id} attendance={attendance} canRecord={canRecord} now={now} />}

        {tab === "jadwal" && (
          <ScheduleTab
            activityId={activity.id}
            occurrences={occurrences}
            page={parsePage(query.jadwal)}
            query={query}
            canEdit={canEdit}
            canRecord={canRecord}
            now={now}
          />
        )}

        {tab === "pengaturan" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Ubah kegiatan</CardTitle>
                <CardDescription>
                  Mengubah aturan untuk seluruh jadwal. Untuk perubahan mulai tanggal tertentu, gunakan &ldquo;Ubah ini
                  &amp; seterusnya&rdquo;.
                </CardDescription>
                {activity.freq !== "ONCE" && (
                  <CardAction>
                    <Link href={`${path}/geser`} className={buttonVariants({ variant: "outline" })}>
                      <CalendarClock />
                      Ubah ini &amp; seterusnya
                    </Link>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                <ActivityForm
                  mode="edit"
                  activityId={activity.id}
                  defaultValues={{
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
                  }}
                />
              </CardContent>
            </Card>

            <DangerZone>
              <DangerZoneItem
                title="Akhiri kegiatan"
                description="Tidak ada jadwal lagi mulai tanggal yang dipilih; jadwal dan absensi sebelumnya tetap."
              >
                <EndActivityForm activityId={activity.id} />
              </DangerZoneItem>
              <DangerZoneItem
                title="Hapus kegiatan"
                description="Kegiatan disembunyikan dari daftar; riwayat absensi tetap tersimpan."
              >
                <DeleteActivityForm activityId={activity.id} />
              </DangerZoneItem>
            </DangerZone>
          </>
        )}
      </div>
    </div>
  );
}

/** Data for the "Absensi" tab; loaded by the page so the tab itself stays a sync component. */
async function loadAttendance(
  activity: Awaited<ReturnType<typeof resolveActivity>>,
  query: Record<string, string | string[] | undefined>,
  now: string,
) {
  const statsRange = resolveDateRange(query, STATS_DATE_RANGE, now);
  // STATS_DATE_RANGE has no open-ended mode, so both bounds are always set.
  const statsFrom = statsRange.from!;
  const statsTo = statsRange.to!;
  const summary = await activityAttendanceSummary(activity.id, toActivityTemplate(activity), activity.group.path, {
    from: statsFrom,
    to: statsTo,
  });
  return { statsRange, statsFrom, statsTo, summary };
}

function AttendanceTab({
  activityId,
  attendance: { statsRange, statsFrom, statsTo, summary },
  canRecord,
  now,
}: {
  activityId: number;
  attendance: Awaited<ReturnType<typeof loadAttendance>>;
  canRecord: boolean;
  now: string;
}) {
  const path = `/dashboard/kegiatan/${activityId}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rekap absensi</CardTitle>
        <CardDescription>Kehadiran di seluruh grup yang mengikuti kegiatan ini.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FilterBar
          action={path}
          isFiltered={statsRange.mode !== STATS_DATE_RANGE.defaultMode || statsRange.anchor !== now}
          resetHref={path}
        >
          <DateRangeFilter range={statsRange} {...STATS_DATE_RANGE} today={now} />
        </FilterBar>
        <ActivityAttendanceChart
          summary={summary}
          from={statsFrom}
          to={statsTo}
          activityId={activityId}
          canRecord={canRecord}
        />
      </CardContent>
    </Card>
  );
}

function ScheduleTab({
  activityId,
  occurrences,
  page,
  query,
  canEdit,
  canRecord,
  now,
}: {
  activityId: number;
  occurrences: ReturnType<typeof occurrencesFor>;
  page: number;
  query: Record<string, string | string[] | undefined>;
  canEdit: boolean;
  canRecord: boolean;
  now: string;
}) {
  const schedulePage = paginate(occurrences, page, EMBEDDED_PAGE_SIZE);
  const path = `/dashboard/kegiatan/${activityId}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jadwal {CONFLICT_HORIZON_DAYS} hari ke depan</CardTitle>
        {canEdit && <CardDescription>Ubah satu tanggal (batal, pindah, ganti jam) lewat ikon pensil.</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {occurrences.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {schedulePage.items.map((occurrence) => {
              const cancelled = occurrence.status === "CANCELLED";
              const moved = occurrence.effectiveDate !== occurrence.key;
              const isToday = occurrence.effectiveDate === now;
              return (
                <li key={occurrence.key} className="flex items-center gap-3 py-2.5">
                  <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-muted leading-none">
                    <span className="text-[0.65rem] text-muted-foreground uppercase">
                      {WEEKDAY_LABELS[weekdayOf(occurrence.effectiveDate)].slice(0, 3)}
                    </span>
                    <span className="text-base font-semibold">{Number(occurrence.effectiveDate.slice(8))}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("flex flex-wrap items-center gap-1.5 text-sm font-medium", cancelled && "text-muted-foreground line-through")}>
                      {formatDate(occurrence.effectiveDate)}
                      {isToday && <Badge>Hari ini</Badge>}
                      {moved && <Badge variant="outline">Dipindah dari {formatDate(occurrence.key)}</Badge>}
                      {cancelled && <Badge variant="destructive">Batal</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {occurrence.effectiveStartTime} · {occurrence.effectiveDurationMinutes} menit ·{" "}
                      {occurrence.effectiveLocation}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canEdit && (
                      <OccurrenceOverrideDialog
                        activityId={activityId}
                        occurrenceKey={occurrence.key}
                        isCancelled={cancelled}
                        effectiveDate={occurrence.effectiveDate}
                        effectiveStartTime={occurrence.effectiveStartTime}
                        effectiveDurationMinutes={occurrence.effectiveDurationMinutes}
                        effectiveLocation={occurrence.effectiveLocation}
                        effectiveNotes={occurrence.effectiveNotes}
                      />
                    )}
                    <Link
                      href={`${path}/${occurrence.key}`}
                      className={buttonVariants({ variant: isToday && canRecord && !cancelled ? "default" : "ghost" })}
                    >
                      {isToday && canRecord && !cancelled ? "Isi absensi" : "Lihat"}
                      <ChevronRight data-icon="inline-end" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Tidak ada jadwal dalam {CONFLICT_HORIZON_DAYS} hari ke depan.
          </p>
        )}
        <Pagination {...schedulePage} scroll={false} hrefFor={(target) => pageHref(path, query, target, "jadwal")} />
      </CardContent>
    </Card>
  );
}

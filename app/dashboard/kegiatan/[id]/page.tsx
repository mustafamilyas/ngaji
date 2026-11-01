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
import { BreakdownSection } from "@/components/breakdown/breakdown-section";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar } from "@/components/filters/filter-bar";
import { MetaItem, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { TabNav, type TabItem } from "@/components/tab-nav";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityTags } from "@/components/tags/entity-tags";
import { scheduleLabel, WEEKDAY_LABELS } from "@/lib/activity/labels";
import { toActivityTemplate } from "@/lib/activity/template";
import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import { canEditActivity } from "@/lib/authz";
import { CONFLICT_HORIZON_DAYS, EMBEDDED_PAGE_SIZE, STATS_DATE_RANGE } from "@/lib/constants";
import { addDays, today, weekdayOf } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { breakdownParam, formatDate, parseBreakdown, parsePage, resolveDateRange } from "@/lib/filters";
import { pageHref, paginate } from "@/lib/pagination";
import { participationPage } from "@/lib/participation/page";
import {
  DEFAULT_OCCURRENCE_SORT,
  DEFAULT_PARTICIPATION_SORT,
  MEMBER_SORT_PARAMS,
  OCCURRENCE_SORT_KEYS,
  OCCURRENCE_SORT_PARAMS,
  PARTICIPATION_SORT_KEYS,
  parseSort,
  sortOccurrences,
  sortPreserve,
} from "@/lib/sort";
import { resolveActivity } from "@/lib/resolve";
import { tagChoices } from "@/lib/tag/choices";
import { loadEntityTags, loadTagOptions } from "@/lib/tag/entity";
import { resolveBreakdown } from "@/lib/summary/breakdown";
import type { SessionUser } from "@/lib/auth/session-user";
import { isInScope } from "@/lib/scope";
import { activityAttendanceSummary } from "@/lib/stats";
import { parseTab, tabHref } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import { ActivityForm } from "../activity-form";
import { ParticipationTable } from "@/app/dashboard/statistik/participation-table";
import { ActivityAttendanceChart } from "./attendance-chart";
import { OccurrenceTable } from "./occurrence-table";
import { DeleteActivityForm } from "./delete-activity-form";
import { EndActivityForm } from "./end-activity-form";
import { OccurrenceOverrideDialog } from "./occurrence-override-dialog";

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

  const now = today(session.user.timeZone);
  const scheduleTo = addDays(now, CONFLICT_HORIZON_DAYS);
  const [rows, entityTags] = await Promise.all([
    loadOccurrenceRows(activity.id, now, scheduleTo),
    loadEntityTags(session.user, { kind: "activity", id: activity.id }),
  ]);
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
  const attendance = tab === "absensi" ? await loadAttendance(activity, query, now, session.user) : null;

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
                <Link href={`/dashboard/grup/${activity.group.id}`} className="inline-flex min-h-11 items-center hover:text-foreground hover:underline xl:min-h-0">
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

      <EntityTags {...entityTags} />

      <div className="flex flex-col gap-4">
        <TabNav path={path} tabs={tabs} current={tab} defaultTab="absensi" />

        {attendance && <AttendanceTab activityId={activity.id} attendance={attendance} canRecord={canRecord} now={now} query={query} />}

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
                description="Tidak ada jadwal lagi mulai tanggal yang dipilih; jadwal dan absensi sebelumnya tetap. Jika tanggalnya sama dengan atau sebelum tanggal mulai, kegiatan dihapus."
              >
                <EndActivityForm activityId={activity.id} startsOn={activity.startsOn} />
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
  user: SessionUser,
) {
  const statsRange = resolveDateRange(query, STATS_DATE_RANGE, now);
  // STATS_DATE_RANGE has no open-ended mode, so both bounds are always set.
  const statsFrom = statsRange.from!;
  const statsTo = statsRange.to!;
  const choice = parseBreakdown(query.rincian);
  const breakdown = await resolveBreakdown(user, choice);
  const summary = await activityAttendanceSummary(activity.id, toActivityTemplate(activity), activity.group.path, {
    from: statsFrom,
    to: statsTo,
    timeZone: user.timeZone,
    breakdown,
  });
  const choices = tagChoices((await loadTagOptions(user)).visible);
  // An unusable choice (invisible tag…) resolved to none: no breakdown, no error.
  const rincian = breakdown && choice ? breakdownParam(choice) : undefined;
  return { statsRange, statsFrom, statsTo, summary, choices, rincian };
}

function AttendanceTab({
  activityId,
  attendance: { statsRange, statsFrom, statsTo, summary, choices, rincian },
  canRecord,
  now,
  query,
}: {
  activityId: number;
  attendance: Awaited<ReturnType<typeof loadAttendance>>;
  canRecord: boolean;
  now: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const path = `/dashboard/kegiatan/${activityId}`;

  const occurrenceSort = parseSort(query, OCCURRENCE_SORT_KEYS, DEFAULT_OCCURRENCE_SORT, OCCURRENCE_SORT_PARAMS);
  const memberSort = parseSort(query, PARTICIPATION_SORT_KEYS, DEFAULT_PARTICIPATION_SORT, MEMBER_SORT_PARAMS);
  const occurrencePage = paginate(
    sortOccurrences(summary.occurrences, occurrenceSort),
    parsePage(query[OCCURRENCE_SORT_PARAMS.page]),
    EMBEDDED_PAGE_SIZE,
  );
  const memberPage = participationPage(summary.participation, {
    sort: memberSort,
    page: parsePage(query[MEMBER_SORT_PARAMS.page]),
    pageSize: EMBEDDED_PAGE_SIZE,
  });
  // `summary.occurrences` is newest first; the trend reads oldest first.
  const trend = [...summary.occurrences].reverse().map((o) => ({ date: o.effectiveDate, percentHadir: o.percentHadir }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rekap absensi</CardTitle>
        <CardDescription>Kehadiran di seluruh grup yang mengikuti kegiatan ini.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FilterBar
          action={path}
          preserve={{
            ...(rincian ? { rincian } : {}),
            // A range change keeps both tables' order; their pages are not preserved, so each starts at page 1.
            ...sortPreserve(occurrenceSort, DEFAULT_OCCURRENCE_SORT, OCCURRENCE_SORT_PARAMS),
            ...sortPreserve(memberSort, DEFAULT_PARTICIPATION_SORT, MEMBER_SORT_PARAMS),
          }}
          isFiltered={statsRange.mode !== STATS_DATE_RANGE.defaultMode || statsRange.anchor !== now}
          resetHref={path}
        >
          <DateRangeFilter range={statsRange} {...STATS_DATE_RANGE} today={now} />
        </FilterBar>
        <ActivityAttendanceChart
          from={statsFrom}
          to={statsTo}
          totals={{
            occurrenceCount: summary.occurrences.length,
            hadir: summary.totalHadir,
            izin: summary.totalIzin,
            absent: summary.totalExpected - summary.totalHadir - summary.totalIzin,
            percentHadir: summary.percentHadir,
          }}
          trend={trend}
        />
        <section aria-labelledby="per-occurrence" className="flex min-w-0 flex-col gap-2">
          <h3 id="per-occurrence" className="text-sm font-medium">
            Per occurrence
          </h3>
          <OccurrenceTable
            page={occurrencePage}
            sort={occurrenceSort}
            activityId={activityId}
            canRecord={canRecord}
            basePath={path}
            searchParams={query}
          />
        </section>
        <section aria-labelledby="siapa-hadir" className="flex min-w-0 flex-col gap-2">
          <h3 id="siapa-hadir" className="text-sm font-medium">
            Siapa yang hadir
          </h3>
          <ParticipationTable
            page={memberPage}
            sort={memberSort}
            basePath={path}
            searchParams={query}
            params={MEMBER_SORT_PARAMS}
            selectLabel="Urutkan peserta"
          />
        </section>
        <BreakdownSection
          choices={choices}
          breakdown={summary.breakdown}
          selected={rincian}
          basePath={path}
          searchParams={query}
          page={parsePage(query.rincianhal)}
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

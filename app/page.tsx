import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarDays, TrendingUp, Users } from "lucide-react";
import { auth } from "@/auth";
import { AttendanceDonut, WeeklyAttendanceChart } from "@/app/dashboard-charts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listActivityOccurrences } from "@/lib/activity/list";
import { DEFAULT_STATS_RANGE_DAYS } from "@/lib/constants";
import { addDays, today } from "@/lib/dates";
import { activityStatistics, memberStatistics, newMembersCount, recentMembers } from "@/lib/stats";
import { cn, initials } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = today();
  const statsFrom = addDays(now, -DEFAULT_STATS_RANGE_DAYS);

  const [memberStats, activityStats, upcoming, todayOccurrences, newMembers, latestMembers] = await Promise.all([
    memberStatistics(session.user),
    activityStatistics(session.user, { from: statsFrom, to: now }),
    listActivityOccurrences(session.user, { from: now, to: addDays(now, 7) }),
    listActivityOccurrences(session.user, { from: now, to: now }),
    newMembersCount(session.user, statsFrom),
    recentMembers(session.user, 5),
  ]);

  const totalExpected = activityStats.occurrences.reduce((sum, o) => sum + o.expected, 0);
  const totalHadir = activityStats.occurrences.reduce((sum, o) => sum + o.hadir, 0);
  const overallPercent = totalExpected > 0 ? Math.round((totalHadir / totalExpected) * 1000) / 10 : 0;
  const nextEntry = upcoming.entries[0];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Dasbor</h1>
          <p className="text-sm text-muted-foreground">Ringkasan anggota dan kegiatan sesuai cakupan Anda.</p>
        </div>
        <Badge variant="outline" className="w-fit">
          {session.user.name} · {session.user.role}
        </Badge>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Anggota aktif"
          value={memberStats.total}
          hint={`+${newMembers} dalam 30 hari`}
          icon={Users}
          tone="brand"
        />
        <StatCard
          label="Occurrence (30 hari)"
          value={activityStats.occurrences.length}
          hint="Kegiatan tercatat"
          icon={CalendarDays}
        />
        <StatCard label="% hadir keseluruhan" value={`${overallPercent}%`} hint="Rata-rata 30 hari" icon={TrendingUp} />
        <StatCard label="7 hari ke depan" value={upcoming.entries.length} hint="Kegiatan mendatang" icon={Bell} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tren kehadiran</CardTitle>
            <CardDescription>% hadir per tanggal, 30 hari terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            {activityStats.trend.length > 0 ? (
              <WeeklyAttendanceChart trend={activityStats.trend} />
            ) : (
              <EmptyState text="Belum ada data kehadiran." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kegiatan berikutnya</CardTitle>
          </CardHeader>
          <CardContent>
            {nextEntry ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="font-medium">{nextEntry.activityName}</p>
                  <p className="text-sm text-muted-foreground">
                    {nextEntry.effectiveDate} · {nextEntry.effectiveStartTime}
                  </p>
                  <p className="text-xs text-muted-foreground">{nextEntry.groupName}</p>
                </div>
                <Link
                  href={`/kegiatan/${nextEntry.activityId}`}
                  className={cn(buttonVariants({ size: "sm" }), "w-fit")}
                >
                  Lihat detail
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak ada kegiatan mendatang.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Kegiatan 7 hari ke depan</CardTitle>
            <Link href="/kegiatan" className="text-xs text-primary hover:underline">
              Lihat semua
            </Link>
          </CardHeader>
          <CardContent>
            {upcoming.entries.length > 0 ? (
              <ul className="flex flex-col divide-y">
                {upcoming.entries.map((entry) => (
                  <li key={`${entry.activityId}:${entry.key}`} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={`/kegiatan/${entry.activityId}`} className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.activityName}</p>
                      <p className="truncate text-xs text-muted-foreground">{entry.groupName}</p>
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {entry.effectiveDate} · {entry.effectiveStartTime}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Tidak ada kegiatan dalam 7 hari ke depan." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kehadiran keseluruhan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <AttendanceDonut percent={overallPercent} />
            <div className="flex w-full justify-between text-xs text-muted-foreground">
              <span>{totalHadir} hadir</span>
              <span>{totalExpected} expected</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Anggota terbaru</CardTitle>
            <Link href="/anggota" className="text-xs text-primary hover:underline">
              Lihat semua
            </Link>
          </CardHeader>
          <CardContent>
            {latestMembers.length > 0 ? (
              <ul className="flex flex-col divide-y">
                {latestMembers.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 py-2.5">
                    <Avatar>
                      <AvatarFallback>{initials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.groupName}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{member.joinedAt}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Belum ada anggota." />
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-primary-foreground">Kegiatan hari ini</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="text-3xl font-semibold">{todayOccurrences.entries.length}</p>
            <p className="text-sm text-primary-foreground/80">
              {todayOccurrences.entries[0]?.activityName ?? "Tidak ada kegiatan terjadwal."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "brand";
}) {
  return (
    <Card className={cn(tone === "brand" && "bg-primary text-primary-foreground")}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardDescription className={cn(tone === "brand" && "text-primary-foreground/80")}>{label}</CardDescription>
        <Icon className={cn("size-4 text-muted-foreground", tone === "brand" && "text-primary-foreground/80")} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        <p className={cn("text-xs text-muted-foreground", tone === "brand" && "text-primary-foreground/80")}>{hint}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

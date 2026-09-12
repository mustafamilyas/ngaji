import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listActivityOccurrences } from "@/lib/activity/list";
import { DEFAULT_STATS_RANGE_DAYS } from "@/lib/constants";
import { addDays, today } from "@/lib/dates";
import { activityStatistics, memberStatistics } from "@/lib/stats";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = today();
  const statsFrom = addDays(now, -DEFAULT_STATS_RANGE_DAYS);

  const [memberStats, activityStats, upcoming] = await Promise.all([
    memberStatistics(session.user),
    activityStatistics(session.user, { from: statsFrom, to: now }),
    listActivityOccurrences(session.user, { from: now, to: addDays(now, 7) }),
  ]);

  const totalExpected = activityStats.occurrences.reduce((sum, o) => sum + o.expected, 0);
  const totalHadir = activityStats.occurrences.reduce((sum, o) => sum + o.hadir, 0);
  const overallPercent = totalExpected > 0 ? Math.round((totalHadir / totalExpected) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Dasbor</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Anggota aktif</p>
          <p className="text-2xl font-semibold">{memberStats.total}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Occurrence (30 hari)</p>
          <p className="text-2xl font-semibold">{activityStats.occurrences.length}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">% hadir (30 hari)</p>
          <p className="text-2xl font-semibold">{overallPercent}%</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Link href="/statistik" className="text-sm text-primary hover:underline">
          Lihat statistik lengkap
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Kegiatan 7 hari ke depan</h2>
        {upcoming.entries.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {upcoming.entries.map((entry) => (
              <li key={`${entry.activityId}:${entry.key}`} className="py-2">
                <Link
                  href={`/kegiatan/${entry.activityId}`}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>{entry.activityName}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.effectiveDate} · {entry.effectiveStartTime}
                  </span>
                </Link>
                <p className="text-xs text-muted-foreground">{entry.groupName}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Tidak ada kegiatan dalam 7 hari ke depan.</p>
        )}
      </section>
    </div>
  );
}

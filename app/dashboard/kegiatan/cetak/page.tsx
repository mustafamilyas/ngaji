import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { WEEKDAY_LABELS } from "@/lib/activity/labels";
import { listActivityOccurrences } from "@/lib/activity/list";
import { endTimeOf, groupScheduleByDate } from "@/lib/activity/print";
import { ACTIVITY_LIST_DATE_RANGE, PRINT_MAX_MONTHS } from "@/lib/constants";
import { isWithinMonths, today, weekdayOf } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateRange, parseGroupIds, parseSearch, resolveDateRange } from "@/lib/filters";
import { getOrganizationName } from "@/lib/organization";
import { cn } from "@/lib/utils";
import { PrintButton } from "./print-button";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";

export default async function PrintSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;

  const now = today(DEFAULT_TIMEZONE);
  const dateRange = resolveDateRange(params, ACTIVITY_LIST_DATE_RANGE, now);
  const { mode: range, anchor } = dateRange;
  const from = dateRange.from!;
  const to = dateRange.to!;

  const groupIds = parseGroupIds(params.grup);
  const q = parseSearch(params.q);
  const showCancelled = params.batal !== "0";
  const tooLong = !isWithinMonths(from, to, PRINT_MAX_MONTHS);

  let groupsLabel = "";
  let days: ReturnType<typeof groupScheduleByDate> = [];
  if (!tooLong) {
    try {
      const { entries, groups } = await listActivityOccurrences(session.user, { from, to, groupIds, search: q });
      groupsLabel = groups.length === 1 ? groups[0].name : `${groups.length} grup`;
      days = groupScheduleByDate(entries, { showCancelled });
    } catch (error) {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }
  }
  const organizationName = await getOrganizationName();

  function filterParams(): URLSearchParams {
    const sp = new URLSearchParams();
    if (groupIds) sp.set("grup", groupIds.join(","));
    if (q) sp.set("q", q);
    sp.set("range", range);
    if (range === "custom") {
      sp.set("from", from);
      sp.set("to", to);
    } else {
      sp.set("anchor", anchor);
    }
    return sp;
  }
  const backHref = `/dashboard/kegiatan?${filterParams().toString()}`;
  const toggleParams = filterParams();
  if (!showCancelled) toggleParams.delete("batal");
  else toggleParams.set("batal", "0");
  const toggleHref = `/dashboard/kegiatan/cetak?${toggleParams.toString()}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 print:max-w-none print:gap-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft />
          Kembali
        </Link>
        <Link href={toggleHref} className={buttonVariants({ variant: "outline" })} aria-pressed={showCancelled}>
          {showCancelled ? "✓ " : ""}Tampilkan yang batal
        </Link>
        {!tooLong && (
          <span className="ml-auto">
            <PrintButton />
          </span>
        )}
      </div>

      <header className="border-b pb-3">
        <p className="text-sm text-muted-foreground">{organizationName}</p>
        <h1 className="font-heading text-2xl font-semibold">Jadwal Kegiatan</h1>
        <p className="mt-1 text-sm">
          {tooLong ? null : <>{groupsLabel} · </>}
          {formatDateRange(from, to)}
        </p>
        <p className="text-xs text-muted-foreground">Dicetak {formatDate(now)}</p>
      </header>

      {tooLong ? (
        <p className="rounded-lg border px-4 py-10 text-center text-sm">
          Rentang cetak paling lama {PRINT_MAX_MONTHS} bulan. Pilih rentang yang lebih pendek.
        </p>
      ) : days.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada jadwal</p>
      ) : (
        days.map((day) => (
          <section key={day.date} className="break-inside-avoid">
            <h2 className="mb-1 text-sm font-semibold">
              {WEEKDAY_LABELS[weekdayOf(day.date)]}, {formatDate(day.date)}
            </h2>
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="print:table-header-group">
                <tr className="border-y text-left text-xs">
                  <th scope="col" className="w-28 py-1 pr-2 font-medium">Jam</th>
                  <th scope="col" className="w-[24%] py-1 pr-2 font-medium">Kegiatan</th>
                  <th scope="col" className="w-[16%] py-1 pr-2 font-medium">Grup</th>
                  <th scope="col" className="w-[22%] py-1 pr-2 font-medium">Lokasi</th>
                  <th scope="col" className="py-1 font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {day.entries.map((entry) => {
                  const cancelled = entry.status === "CANCELLED";
                  return (
                    <tr key={`${entry.activityId}:${entry.key}`} className="border-b align-top break-inside-avoid">
                      <td className="py-1 pr-2 tabular-nums">
                        {entry.effectiveStartTime}–{endTimeOf(entry.effectiveStartTime, entry.effectiveDurationMinutes)}
                      </td>
                      <td className={cn("py-1 pr-2 font-medium", cancelled && "line-through")}>{entry.activityName}</td>
                      <td className="py-1 pr-2">{entry.groupName}</td>
                      <td className="py-1 pr-2">{entry.effectiveLocation}</td>
                      <td className="py-1">
                        {[entry.moved && "Dipindah", cancelled && "Batal"].filter(Boolean).join(", ")}
                        {(entry.moved || cancelled) && entry.effectiveNotes ? " · " : ""}
                        {entry.effectiveNotes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}

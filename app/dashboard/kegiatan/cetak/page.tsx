import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { touchButton } from "@/components/ui/touch";
import { WEEKDAY_LABELS } from "@/lib/activity/labels";
import { listActivityOccurrences } from "@/lib/activity/list";
import { endTimeOf, groupScheduleByDate } from "@/lib/activity/print";
import { ACTIVITY_LIST_DATE_RANGE, PRINT_MAX_MONTHS } from "@/lib/constants";
import { isWithinMonths, today, weekdayOf } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateRange, parseGroupIds, parseSearch, resolveDateRange } from "@/lib/filters";
import { getOrganization } from "@/lib/organization";
import { cn } from "@/lib/utils";
import { PrintButton } from "./print-button";

export default async function PrintSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;

  const now = today(session.user.timeZone);
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
  const { name: organizationName } = await getOrganization(session);

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
      {/* Phones: Cetak on top, full width; the two links share a row below it. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center print:hidden">
        {!tooLong && (
          <span className="order-first sm:order-last sm:ml-auto">
            <PrintButton className={cn(touchButton, "w-full sm:w-auto")} />
          </span>
        )}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }), touchButton)}>
            <ArrowLeft />
            Kembali
          </Link>
          <Link
            href={toggleHref}
            className={cn(buttonVariants({ variant: "outline" }), touchButton)}
            aria-pressed={showCancelled}
          >
            {showCancelled ? "✓ " : ""}Tampilkan yang batal
          </Link>
        </div>
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
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground sm:hidden print:hidden">
            Geser tabel ke samping untuk melihat semua kolom. Hasil cetak tetap lengkap.
          </p>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm print:min-w-0 print:text-[11px]">
              <thead className="print:table-header-group">
                <tr className="border-y text-left text-xs">
                  <th scope="col" className="w-24 py-1 pr-2 font-medium print:w-20">Tanggal</th>
                  <th scope="col" className="w-24 py-1 pr-2 font-medium print:w-20">Jam</th>
                  <th scope="col" className="w-[22%] py-1 pr-2 font-medium">Kegiatan</th>
                  <th scope="col" className="w-[14%] py-1 pr-2 font-medium">Grup</th>
                  <th scope="col" className="w-[18%] py-1 pr-2 font-medium">Lokasi</th>
                  <th scope="col" className="py-1 font-medium">Keterangan</th>
                </tr>
              </thead>
              {days.map((day) => (
                <tbody key={day.date} className="border-t-2 border-foreground/60">
                  {day.entries.map((entry, index) => {
                    const cancelled = entry.status === "CANCELLED";
                    return (
                      <tr
                        key={`${entry.activityId}:${entry.key}`}
                        className={cn("align-top break-inside-avoid", index > 0 && "border-t")}
                      >
                        {index === 0 && (
                          <th scope="rowgroup" rowSpan={day.entries.length} className="py-1 pr-2 text-left font-semibold">
                            {WEEKDAY_LABELS[weekdayOf(day.date)]}
                            <br />
                            <span className="font-normal">{formatDate(day.date)}</span>
                          </th>
                        )}
                        <td className="py-1 pr-2 tabular-nums print:py-0.5">
                          {entry.effectiveStartTime}–{endTimeOf(entry.effectiveStartTime, entry.effectiveDurationMinutes)}
                        </td>
                        <td className={cn("py-1 pr-2 font-medium print:py-0.5", cancelled && "line-through")}>
                          {entry.activityName}
                        </td>
                        <td className="py-1 pr-2 print:py-0.5">{entry.groupName}</td>
                        <td className="py-1 pr-2 print:py-0.5">{entry.effectiveLocation}</td>
                        <td className="py-1 print:py-0.5">
                          {[entry.moved && "Dipindah", cancelled && "Batal"].filter(Boolean).join(", ")}
                          {(entry.moved || cancelled) && entry.effectiveNotes ? " · " : ""}
                          {entry.effectiveNotes}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export const WEEKDAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "Mingguan · Senin, Kamis" — the recurrence rule in one line. */
export function scheduleLabel(activity: {
  freq: string;
  interval: number;
  weekdays: unknown;
  monthDay: number | null;
}): string {
  switch (activity.freq) {
    case "WEEKLY": {
      const days = (activity.weekdays as number[]).map((d) => WEEKDAY_LABELS[d]).join(", ");
      return activity.interval > 1 ? `Tiap ${activity.interval} minggu · ${days}` : `Mingguan · ${days}`;
    }
    case "DAILY":
      return activity.interval > 1 ? `Tiap ${activity.interval} hari` : "Harian";
    case "MONTHLY":
      return activity.interval > 1
        ? `Tiap ${activity.interval} bulan, tanggal ${activity.monthDay}`
        : `Bulanan, tanggal ${activity.monthDay}`;
    default:
      return "Sekali";
  }
}

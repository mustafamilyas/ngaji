import type { ActivityTemplate } from "@/lib/activity/occurrences";
import type { Freq } from "@/lib/validation/enums";

/** The subset of an `Activity` row `occurrencesFor`/conflict-checking need, with `weekdays` cast back from JSON. */
export type ActivityRow = {
  freq: string;
  interval: number;
  weekdays: unknown;
  monthDay: number | null;
  startsOn: string;
  endsOn: string | null;
  startTime: string;
  durationMinutes: number;
  location: string;
  notes: string | null;
};

export function toActivityTemplate(activity: ActivityRow): ActivityTemplate {
  return {
    freq: activity.freq as Freq,
    interval: activity.interval,
    weekdays: activity.weekdays as number[],
    monthDay: activity.monthDay,
    startsOn: activity.startsOn,
    endsOn: activity.endsOn,
    startTime: activity.startTime,
    durationMinutes: activity.durationMinutes,
    location: activity.location,
    notes: activity.notes,
  };
}

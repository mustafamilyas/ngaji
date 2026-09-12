import {
  addDays,
  addMonthsOnDay,
  daysBetween,
  sundayOf,
  weekdayOf,
  weeksBetween,
} from "../dates";
import type { Freq } from "../validation/enums";

const MAX_RANGE_DAYS = 366;

/** The recurrence fields of an Activity template. See DESIGN.md §5.1. */
export type ActivityRule = {
  freq: Freq;
  interval: number;
  weekdays: number[];
  monthDay: number | null;
  startsOn: string;
  endsOn: string | null;
};

function min(a: string, b: string): string {
  return a < b ? a : b;
}

function max(a: string, b: string): string {
  return a > b ? a : b;
}

/**
 * Pure recurrence expansion: `YYYY-MM-DD` strings only, no `Date` objects.
 * See DESIGN.md §5.1 and the `activity-scheduling` spec.
 */
export function expandDates(activity: ActivityRule, from: string, to: string): string[] {
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    throw new Error(`Range exceeds ${MAX_RANGE_DAYS} days`);
  }

  const lowerBound = max(activity.startsOn, from);
  const upperBound = activity.endsOn === null ? to : min(activity.endsOn, to);

  if (lowerBound > upperBound) {
    return [];
  }

  switch (activity.freq) {
    case "ONCE":
      return activity.startsOn >= lowerBound && activity.startsOn <= upperBound
        ? [activity.startsOn]
        : [];

    case "DAILY":
      return expandDaily(activity, lowerBound, upperBound);

    case "WEEKLY":
      return expandWeekly(activity, lowerBound, upperBound);

    case "MONTHLY":
      return expandMonthly(activity, lowerBound, upperBound);
  }
}

function expandDaily(activity: ActivityRule, lowerBound: string, upperBound: string): string[] {
  const dates: string[] = [];
  const offsetToLowerBound = daysBetween(activity.startsOn, lowerBound);
  const firstStep = Math.max(0, Math.ceil(offsetToLowerBound / activity.interval));

  let date = addDays(activity.startsOn, firstStep * activity.interval);
  while (date <= upperBound) {
    if (date >= lowerBound) {
      dates.push(date);
    }
    date = addDays(date, activity.interval);
  }
  return dates;
}

function expandWeekly(activity: ActivityRule, lowerBound: string, upperBound: string): string[] {
  const dates: string[] = [];
  const anchorSunday = sundayOf(activity.startsOn);

  let date = lowerBound;
  while (date <= upperBound) {
    if (date >= activity.startsOn && activity.weekdays.includes(weekdayOf(date))) {
      const weeks = weeksBetween(anchorSunday, sundayOf(date));
      if (weeks % activity.interval === 0) {
        dates.push(date);
      }
    }
    date = addDays(date, 1);
  }
  return dates;
}

function expandMonthly(activity: ActivityRule, lowerBound: string, upperBound: string): string[] {
  if (activity.monthDay === null) {
    return [];
  }

  const dates: string[] = [];
  for (let k = 0; ; k++) {
    const candidate = addMonthsOnDay(activity.startsOn, k * activity.interval, activity.monthDay);
    if (candidate !== null) {
      if (candidate > upperBound) {
        break;
      }
      if (candidate >= lowerBound) {
        dates.push(candidate);
      }
    } else if (addMonthsOnDay(activity.startsOn, k * activity.interval, 1)! > upperBound) {
      break;
    }
  }
  return dates;
}

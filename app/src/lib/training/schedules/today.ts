import type {
  ScheduleData,
  TrainingCompletionListData,
} from "@client/api/types";
import type { ScheduleDayEntry } from "./types";

/** JS `Date#getDay()` (0 Sunday..6 Saturday) mapped to ISO weekday (1 Monday..7 Sunday). */
export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Weekday names Monday..Sunday in the given locale (browser default when
 * omitted), via `Intl.DateTimeFormat` rather than a hand-written list.
 * Formats a fixed, known Monday (2024-01-01) in UTC so the result never
 * shifts a day across a local timezone's midnight boundary.
 */
export function weekdayNames(locale?: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
  const monday = Date.UTC(2024, 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(monday + index * dayMs)),
  );
}

/** The schedule's entry for `date`'s ISO weekday, or `null` on a rest day or no active schedule. */
export function todayEntry(
  schedule: ScheduleData | null,
  date: Date,
): ScheduleDayEntry | null {
  if (!schedule) return null;
  const weekday = isoWeekday(date);
  return schedule.days.find((day) => day.dayOfWeek === weekday) ?? null;
}

/** Local midnight of `date`'s calendar day. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whether any of `completions` ran `entry`'s routine; `false` without an entry. */
export function isRoutineCompleted(
  entry: ScheduleDayEntry | null,
  completions: TrainingCompletionListData["items"],
): boolean {
  if (!entry) return false;
  return completions.some(
    (completion) => completion.routineTemplateId === entry.routineId,
  );
}

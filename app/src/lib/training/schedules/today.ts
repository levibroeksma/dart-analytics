import type {
  ScheduleData,
  TrainingCompletionListData,
} from "@client/api/types";
import type { DayStatus, ScheduleDayEntry, WeekCounts } from "./types";

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

/** Local Monday 00:00 of `date`'s ISO week. */
export function startOfIsoWeek(date: Date): Date {
  const monday = startOfLocalDay(date);
  monday.setDate(monday.getDate() - (isoWeekday(date) - 1));
  return monday;
}

/**
 * One weekday's state in the current ISO week (`index` and `today` both 0
 * Monday..6 Sunday). Done wins on any day; otherwise today stays today; a
 * scheduled day before today whose routine was not completed that day is
 * missed. `completions` are this week's.
 */
export function dayStatus(
  index: number,
  today: number,
  schedule: ScheduleData | null,
  completions: TrainingCompletionListData["items"],
): DayStatus {
  const entry =
    schedule?.days.find((day) => day.dayOfWeek === index + 1) ?? null;
  const completed =
    entry !== null &&
    completions.some(
      (completion) =>
        completion.routineTemplateId === entry.routineId &&
        isoWeekday(new Date(completion.completedAt)) - 1 === index,
    );
  if (completed) return "done";
  if (index === today) return "today";
  if (!entry) return "rest";
  return index < today ? "missed" : "scheduled";
}

/** The week's done, missed and to-go totals; a scheduled, not-done today counts to go. */
export function weekCounts(
  today: number,
  schedule: ScheduleData | null,
  completions: TrainingCompletionListData["items"],
): WeekCounts {
  const counts = { done: 0, missed: 0, toGo: 0 };
  for (let index = 0; index < 7; index++) {
    const status = dayStatus(index, today, schedule, completions);
    const scheduled = Boolean(
      schedule?.days.some((day) => day.dayOfWeek === index + 1),
    );
    if (status === "done") counts.done++;
    if (status === "missed") counts.missed++;
    if (status === "scheduled" || (status === "today" && scheduled))
      counts.toGo++;
  }
  return counts;
}

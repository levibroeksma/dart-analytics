import { getActiveSchedule } from "@client/api/schedules";
import { listTrainingCompletions } from "@client/api/training-sessions";
import { routinePlayPath } from "@lib/training/routines/routine-route";
import {
  dayStatus,
  isoWeekday,
  startOfIsoWeek,
  weekCounts,
  weekdayNames,
} from "./today";
import type {
  ScheduleData,
  TrainingCompletionListData,
} from "@client/api/types";
import type { DayStatus, ScheduleDayEntry, TrainingWeekContext } from "./types";

const WEEKDAYS = weekdayNames();

const DAY_CLASSES: Record<DayStatus, string> = {
  done: "size-8.5 bg-accent text-foreground",
  missed:
    "size-8.5 border-2 border-dashed border-missed bg-missed-muted text-missed",
  today: "home-day-today size-10.5 text-[15px] font-bold text-foreground",
  scheduled: "size-8.5 border-2 border-foreground/50 text-foreground",
  rest: "size-8.5 border-2 border-border text-faint-foreground",
};

/** Every day alike while the week loads — no status is known yet. */
const LOADING_DAY_CLASS =
  "size-8.5 animate-pulse border-2 border-white/12 text-faint-foreground";

/**
 * `/training`'s "My schedule" card: the active schedule and this ISO week's
 * completions, read into a per-day status (done, missed, today, scheduled,
 * rest) and the week's done/missed/to-go totals. A failed read falls back to
 * no schedule.
 */
export function trainingWeek() {
  const now = new Date();
  return {
    loading: true,
    schedule: null as ScheduleData | null,
    completions: [] as TrainingCompletionListData["items"],
    today: isoWeekday(now) - 1,

    async init(this: TrainingWeekContext) {
      this.loading = true;
      try {
        const [schedule, completions] = await Promise.all([
          getActiveSchedule(),
          listTrainingCompletions(startOfIsoWeek(now).toISOString()),
        ]);
        this.schedule = schedule;
        this.completions = completions.items;
      } catch {
        this.schedule = null;
        this.completions = [];
      } finally {
        this.loading = false;
      }
    },

    applySaved(this: TrainingWeekContext, schedule: ScheduleData) {
      this.schedule = schedule;
    },

    status(this: TrainingWeekContext, index: number) {
      return dayStatus(index, this.today, this.schedule, this.completions);
    },

    dayClass(this: TrainingWeekContext, index: number) {
      if (this.loading) return LOADING_DAY_CLASS;
      return DAY_CLASSES[this.status(index)];
    },

    counts(this: TrainingWeekContext) {
      return weekCounts(this.today, this.schedule, this.completions);
    },

    hasSchedule(this: TrainingWeekContext) {
      return this.schedule !== null;
    },

    navigate(path: string) {
      globalThis.location.href = path;
    },

    todayEntry(this: TrainingWeekContext): ScheduleDayEntry | null {
      return (
        this.schedule?.days.find((day) => day.dayOfWeek === this.today + 1) ??
        null
      );
    },

    canStart(this: TrainingWeekContext): boolean {
      return (
        !this.loading &&
        this.todayEntry() !== null &&
        this.status(this.today) !== "done"
      );
    },

    start(this: TrainingWeekContext) {
      const entry = this.todayEntry();
      if (entry) this.navigate(routinePlayPath(entry.routineId));
    },

    letter(index: number) {
      return (WEEKDAYS[index] ?? "").charAt(0).toLowerCase();
    },

    dayLabel(this: TrainingWeekContext, index: number) {
      return `${WEEKDAYS[index] ?? ""}, ${this.status(index)}`;
    },
  };
}

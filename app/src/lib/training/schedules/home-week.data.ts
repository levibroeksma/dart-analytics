import { getActiveSchedule } from "@client/api/schedules";
import { listTrainingCompletions } from "@client/api/training-sessions";
import { routinePlayPath } from "@lib/training/routines/routine-route";
import {
  isoWeekday,
  isRoutineCompleted,
  startOfLocalDay,
  todayEntry,
} from "./today";
import type {
  ScheduleData,
  TrainingCompletionListData,
} from "@client/api/types";
import type { HomeWeekContext, ScheduleDayEntry } from "./types";

/**
 * Homepage week strip and today card: the active schedule's weekdays, and
 * whether today's routine was already completed since local midnight.
 */
export function homeWeek() {
  const now = new Date();
  return {
    loading: true,
    schedule: null as ScheduleData | null,
    completions: [] as TrainingCompletionListData["items"],
    today: isoWeekday(now) - 1,

    async init(this: HomeWeekContext) {
      this.loading = true;
      try {
        const [schedule, completions] = await Promise.all([
          getActiveSchedule(),
          listTrainingCompletions(startOfLocalDay(now).toISOString()),
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

    isToday(this: HomeWeekContext, index: number): boolean {
      return index === this.today;
    },

    hasRoutine(this: HomeWeekContext, index: number): boolean {
      return Boolean(
        this.schedule?.days.some((day) => day.dayOfWeek === index + 1),
      );
    },

    /** Today in accent (filled when it has a routine) at 110%; other days muted (filled when they have one). */
    dayClass(this: HomeWeekContext, index: number): string {
      const filled = this.hasRoutine(index);
      if (this.isToday(index)) {
        return filled
          ? "scale-110 border-accent bg-accent text-accent-foreground"
          : "scale-110 border-accent text-accent";
      }
      return filled
        ? "border-muted bg-muted text-foreground"
        : "border-muted text-muted";
    },

    todayEntry(this: HomeWeekContext): ScheduleDayEntry | null {
      return todayEntry(this.schedule, new Date());
    },

    doneToday(this: HomeWeekContext): boolean {
      return isRoutineCompleted(this.todayEntry(), this.completions);
    },

    showStart(this: HomeWeekContext): boolean {
      return !this.loading && this.todayEntry() !== null && !this.doneToday();
    },

    showDone(this: HomeWeekContext): boolean {
      return !this.loading && this.doneToday();
    },

    startHref(this: HomeWeekContext): string {
      const entry = this.todayEntry();
      return entry ? routinePlayPath(entry.routineId) : "/training";
    },
  };
}

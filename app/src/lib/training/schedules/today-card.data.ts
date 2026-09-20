import { getActiveSchedule } from "@client/api/schedules";
import { routinePlayPath } from "@lib/training/routines/routine-route";
import { todayEntry } from "./today";
import type { ScheduleData } from "@client/api/types";
import type { ScheduleDayEntry, TodayCardContext } from "./types";

/**
 * `/training`'s Today card: the active schedule's routine for today (or
 * rest), resolved client-side (`today.ts`) since the API has no notion of
 * the player's local weekday.
 */
export function todayCard() {
  return {
    loading: true,
    error: "",
    schedule: null as ScheduleData | null,

    navigate(path: string) {
      globalThis.location.href = path;
    },

    async init(this: TodayCardContext) {
      this.loading = true;
      this.error = "";
      try {
        this.schedule = await getActiveSchedule();
      } catch {
        this.error = "Could not load today's training.";
      } finally {
        this.loading = false;
      }
    },

    entry(this: TodayCardContext): ScheduleDayEntry | null {
      return todayEntry(this.schedule, new Date());
    },

    isRestDay(this: TodayCardContext): boolean {
      return this.schedule !== null && this.entry() === null;
    },

    startPath(this: TodayCardContext): string {
      const entry = this.entry();
      return entry ? routinePlayPath(entry.routineId) : "/training";
    },

    start(this: TodayCardContext) {
      this.navigate(this.startPath());
    },
  };
}

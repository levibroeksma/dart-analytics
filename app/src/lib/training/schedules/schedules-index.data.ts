import {
  listSchedules,
  activateSchedule,
  deactivateSchedule,
} from "@client/api/schedules";
import { scheduleEditPath } from "./schedule-route";
import type { ScheduleSummaryData } from "@client/api/types";
import type { SchedulesIndexContext } from "./types";

/** `/training/schedules`: the player's own schedules, with activate/deactivate. */
export function schedulesIndex() {
  return {
    loading: true,
    error: "",
    schedules: [] as ScheduleSummaryData[],
    busyId: null as string | null,

    navigate(path: string) {
      globalThis.location.href = path;
    },

    async init(this: SchedulesIndexContext) {
      await this.refresh();
    },

    async refresh(this: SchedulesIndexContext) {
      this.loading = true;
      this.error = "";
      try {
        this.schedules = (await listSchedules()).items;
      } catch {
        this.error =
          "Could not load your schedules. Check your connection and reload.";
      } finally {
        this.loading = false;
      }
    },

    editHref(schedule: ScheduleSummaryData): string {
      return scheduleEditPath(schedule.scheduleId);
    },

    async activate(this: SchedulesIndexContext, schedule: ScheduleSummaryData) {
      if (this.busyId) return;
      this.busyId = schedule.scheduleId;
      this.error = "";
      try {
        await activateSchedule(schedule.scheduleId);
        await this.refresh();
      } catch {
        this.error = "Could not activate this schedule.";
      } finally {
        this.busyId = null;
      }
    },

    async deactivate(
      this: SchedulesIndexContext,
      schedule: ScheduleSummaryData,
    ) {
      if (this.busyId) return;
      this.busyId = schedule.scheduleId;
      this.error = "";
      try {
        await deactivateSchedule(schedule.scheduleId);
        await this.refresh();
      } catch {
        this.error = "Could not deactivate this schedule.";
      } finally {
        this.busyId = null;
      }
    },
  };
}

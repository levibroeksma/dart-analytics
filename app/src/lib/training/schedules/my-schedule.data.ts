import {
  activateSchedule,
  createSchedule,
  getActiveSchedule,
  updateSchedule,
} from "@client/api/schedules";
import { listRoutines } from "@client/api/routines";
import { SessionApiError } from "@client/api/sessions";
import { isoWeekday, weekdayNames } from "./today";
import { formatScheduleIssues } from "./schedule-issues";
import type { RoutineSummaryData, ScheduleData } from "@client/api/types";
import type { MyScheduleFormContext, ScheduleEditorRow } from "./types";

/** Name given to the schedule the `/training` modal creates when none is active. */
export const MY_SCHEDULE_NAME = "My schedule";

/** Window event carrying the saved `ScheduleData` as `detail`. */
const SCHEDULE_SAVED_EVENT = "schedule-saved";

const WEEKDAY_LABELS = weekdayNames();

function rowsFor(schedule: ScheduleData | null): ScheduleEditorRow[] {
  return WEEKDAY_LABELS.map((_, index) => ({
    dayOfWeek: index + 1,
    routineTemplateId:
      schedule?.days.find((day) => day.dayOfWeek === index + 1)?.routineId ??
      null,
  }));
}

/**
 * `/training`'s "My schedule" modal: the seven weekdays as a day picker and
 * the routine catalog as a single-select list for the picked day. Edits the
 * active schedule in place, or creates and activates `MY_SCHEDULE_NAME` when
 * none is active. Saving needs at least one day with a routine.
 */
export function myScheduleForm() {
  return {
    loading: true,
    saving: false,
    error: "",
    serverIssues: [] as string[],
    scheduleId: null as string | null,
    name: MY_SCHEDULE_NAME,
    rows: rowsFor(null),
    routines: [] as RoutineSummaryData[],
    selectedIndex: isoWeekday(new Date()) - 1,

    async init(this: MyScheduleFormContext) {
      this.loading = true;
      this.error = "";
      this.serverIssues = [];
      try {
        const [catalog, active] = await Promise.all([
          listRoutines(),
          getActiveSchedule(),
        ]);
        this.routines = catalog.items;
        this.applySchedule(active);
      } catch {
        this.error = "Could not load your schedule.";
      } finally {
        this.loading = false;
      }
    },

    applySchedule(this: MyScheduleFormContext, schedule: ScheduleData | null) {
      this.scheduleId = schedule?.scheduleId ?? null;
      this.name = schedule?.name ?? MY_SCHEDULE_NAME;
      this.rows = rowsFor(schedule);
    },

    async resetForm(this: MyScheduleFormContext) {
      this.selectedIndex = isoWeekday(new Date()) - 1;
      await this.init();
    },

    dayInitial(index: number): string {
      return (WEEKDAY_LABELS[index] ?? "").charAt(0).toLowerCase();
    },

    dayLabel(index: number): string {
      return WEEKDAY_LABELS[index] ?? "";
    },

    selectedDayLabel(this: MyScheduleFormContext): string {
      return this.dayLabel(this.selectedIndex);
    },

    selectDay(this: MyScheduleFormContext, index: number) {
      this.selectedIndex = index;
    },

    hasRoutine(this: MyScheduleFormContext, index: number): boolean {
      return Boolean(this.rows[index]?.routineTemplateId);
    },

    isRoutineSelected(
      this: MyScheduleFormContext,
      routine: RoutineSummaryData,
    ): boolean {
      return (
        this.rows[this.selectedIndex]?.routineTemplateId === routine.routineId
      );
    },

    toggleRoutine(this: MyScheduleFormContext, routine: RoutineSummaryData) {
      const row = this.rows[this.selectedIndex];
      if (!row) return;
      row.routineTemplateId = this.isRoutineSelected(routine)
        ? null
        : routine.routineId;
    },

    canSave(this: MyScheduleFormContext): boolean {
      if (this.saving || this.loading) return false;
      return this.rows.some((row) => Boolean(row.routineTemplateId));
    },

    payload(this: MyScheduleFormContext) {
      return {
        name: this.name,
        days: this.rows.flatMap((row) =>
          row.routineTemplateId
            ? [
                {
                  dayOfWeek: row.dayOfWeek,
                  routineTemplateId: row.routineTemplateId,
                },
              ]
            : [],
        ),
      };
    },

    /** Resolves `true` once saved, so the caller can close the modal. */
    async save(this: MyScheduleFormContext): Promise<boolean> {
      if (!this.canSave()) return false;
      this.saving = true;
      this.error = "";
      this.serverIssues = [];
      try {
        const saved = this.scheduleId
          ? await updateSchedule(this.scheduleId, this.payload())
          : await activateSchedule(
              (await createSchedule(this.payload())).scheduleId,
            );
        this.applySchedule(saved);
        globalThis.dispatchEvent(
          new CustomEvent(SCHEDULE_SAVED_EVENT, { detail: saved }),
        );
        return true;
      } catch (err) {
        if (
          err instanceof SessionApiError &&
          err.code === "VALIDATION_FAILED"
        ) {
          this.serverIssues = formatScheduleIssues(err.details);
        } else {
          this.error =
            "Could not save your schedule. Check your connection and retry.";
        }
        return false;
      } finally {
        this.saving = false;
      }
    },
  };
}

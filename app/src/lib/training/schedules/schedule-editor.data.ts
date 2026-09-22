import {
  createSchedule,
  getSchedule,
  updateSchedule,
} from "@client/api/schedules";
import { listRoutines } from "@client/api/routines";
import { SessionApiError } from "@client/api/sessions";
import { MAX_SCHEDULE_NAME_LENGTH } from "@routes/schedules/types";
import { scheduleIdFromLocation } from "./schedule-route";
import { weekdayNames } from "./today";
import { formatScheduleIssues } from "./schedule-issues";
import type { RoutineSummaryData } from "@client/api/types";
import type { ScheduleEditorContext, ScheduleEditorRow } from "./types";

const DAY_COUNT = 7;
const WEEKDAY_LABELS = weekdayNames();

function restRows(): ScheduleEditorRow[] {
  return Array.from({ length: DAY_COUNT }, (_, index) => ({
    dayOfWeek: index + 1,
    routineTemplateId: null,
  }));
}

/**
 * Editor state for `/training/schedules/new` and `/edit`. Seven rows,
 * Monday..Sunday, each holding a routine id or `null` for rest; only the
 * mapped rows go into the create/update payload. Lives in the page's
 * `x-data`, not a store (`app/src/stores/CLAUDE.md`).
 */
export function scheduleEditor(mode: "create" | "edit") {
  return {
    mode,
    scheduleId: null as string | null,
    loading: true,
    saving: false,
    error: "",
    serverIssues: [] as string[],
    name: "",
    rows: restRows(),
    routines: [] as RoutineSummaryData[],
    maxNameLength: MAX_SCHEDULE_NAME_LENGTH,

    navigate(path: string) {
      globalThis.location.href = path;
    },

    async init(this: ScheduleEditorContext) {
      this.loading = true;
      this.error = "";
      try {
        this.routines = (await listRoutines()).items;
      } catch {
        this.error = "Could not load the routine catalog.";
        this.loading = false;
        return;
      }
      if (this.mode === "edit") {
        try {
          await this.loadExisting();
        } catch {
          this.error = "Could not load this schedule.";
        }
      }
      this.loading = false;
    },

    async loadExisting(this: ScheduleEditorContext) {
      const scheduleId = scheduleIdFromLocation();
      if (!scheduleId) {
        this.error = "No schedule selected.";
        return;
      }
      const schedule = await getSchedule(scheduleId);
      this.scheduleId = schedule.scheduleId;
      this.name = schedule.name;
      this.rows = restRows().map((row) => {
        const day = schedule.days.find((d) => d.dayOfWeek === row.dayOfWeek);
        return day ? { ...row, routineTemplateId: day.routineId } : row;
      });
    },

    routineLabel(routine: RoutineSummaryData): string {
      return `${routine.routineName} (${routine.totalMinutes} min)`;
    },

    weekdayLabel(index: number): string {
      return WEEKDAY_LABELS[index] ?? "";
    },

    nameValid(this: ScheduleEditorContext): boolean {
      const trimmed = this.name.trim();
      return trimmed.length > 0 && trimmed.length <= this.maxNameLength;
    },

    canSave(this: ScheduleEditorContext): boolean {
      if (this.saving || this.loading) return false;
      if (this.mode === "edit" && !this.scheduleId) return false;
      return this.nameValid();
    },

    /**
     * The Rest `<select>` option's value is `""` (native selects can't carry
     * a real `null`) — treats any falsy `routineTemplateId` as rest, not only
     * `null`, so a row the user set back to Rest is dropped too.
     */
    payload(this: ScheduleEditorContext) {
      return {
        name: this.name.trim(),
        days: this.rows
          .filter(
            (row): row is ScheduleEditorRow & { routineTemplateId: string } =>
              Boolean(row.routineTemplateId),
          )
          .map((row) => ({
            dayOfWeek: row.dayOfWeek,
            routineTemplateId: row.routineTemplateId,
          })),
      };
    },

    async save(this: ScheduleEditorContext) {
      if (!this.canSave()) return;
      this.saving = true;
      this.error = "";
      this.serverIssues = [];
      try {
        this.mode === "edit" && this.scheduleId
          ? await updateSchedule(this.scheduleId, this.payload())
          : await createSchedule(this.payload());
        this.navigate("/training/schedules");
      } catch (err) {
        if (
          err instanceof SessionApiError &&
          err.code === "VALIDATION_FAILED"
        ) {
          this.serverIssues = formatScheduleIssues(err.details);
        } else {
          this.error =
            "Could not save this schedule. Check your connection and retry.";
        }
      } finally {
        this.saving = false;
      }
    },

    cancel(this: ScheduleEditorContext) {
      this.navigate("/training/schedules");
    },
  };
}

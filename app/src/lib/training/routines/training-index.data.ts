import { listRoutines } from "@client/api/routines";
import { routineDetailPath } from "./routine-route";
import { routineSelectOptions } from "./routine-options";
import type { RoutineSummaryData } from "@client/api/types";
import type { SelectOption, TrainingIndexContext } from "./types";

export function trainingIndex() {
  return {
    loading: true,
    error: "",
    showModal: false,
    showScheduleModal: false,
    routines: [] as RoutineSummaryData[],
    selectedRoutineId: "",

    async init(this: TrainingIndexContext) {
      this.loading = true;
      this.error = "";
      try {
        this.routines = (await listRoutines()).items;
        this.selectedRoutineId = this.routineOptions()[0]?.value ?? "";
      } catch {
        this.error =
          "Could not load your routines. Check your connection and reload.";
      } finally {
        this.loading = false;
      }
    },

    routineOptions(this: TrainingIndexContext): SelectOption[] {
      return routineSelectOptions(this.routines);
    },

    selectedRoutine(this: TrainingIndexContext): RoutineSummaryData | null {
      return (
        this.routines.find(
          (routine) => routine.routineId === this.selectedRoutineId,
        ) ?? null
      );
    },

    durationLabel(routine: RoutineSummaryData): string {
      return `${routine.totalMinutes} min`;
    },

    detailHref(routine: RoutineSummaryData): string {
      return routineDetailPath(routine.routineId);
    },
  };
}

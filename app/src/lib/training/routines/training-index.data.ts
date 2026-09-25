import { listRoutines } from "@client/api/routines";
import { routineDetailPath } from "./routine-route";
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
      return [
        ...this.routines.filter((routine) => routine.isSystemTemplate),
        ...this.routines.filter((routine) => !routine.isSystemTemplate),
      ].map((routine) => ({
        value: routine.routineId,
        label: routine.routineName,
      }));
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

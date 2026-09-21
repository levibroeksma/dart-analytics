import { listRoutines } from "@client/api/routines";
import { routineDetailPath } from "./routine-route";
import type { RoutineSummaryData } from "@client/api/types";
import type { TrainingIndexContext } from "./types";

export function trainingIndex() {
  return {
    loading: true,
    error: "",
    showModal: false,
    routines: [] as RoutineSummaryData[],

    async init(this: TrainingIndexContext) {
      this.loading = true;
      this.error = "";
      try {
        this.routines = (await listRoutines()).items;
      } catch {
        this.error =
          "Could not load your routines. Check your connection and reload.";
      } finally {
        this.loading = false;
      }
    },

    durationLabel(routine: RoutineSummaryData): string {
      return `${routine.totalMinutes} min`;
    },

    detailHref(routine: RoutineSummaryData): string {
      return routineDetailPath(routine.routineId);
    },
  };
}

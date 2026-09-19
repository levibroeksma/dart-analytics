import { deleteRoutine, getRoutine } from "@client/api/routines";
import {
  routineEditPath,
  routineIdFromLocation,
  routinePlayPath,
} from "./routine-route";
import type { RoutineExecutionData } from "@client/api/types";
import type { RoutineDetailContext } from "./types";

type Step = RoutineExecutionData["steps"][number];

export function routineDetail() {
  return {
    loading: true,
    error: "",
    routine: null as RoutineExecutionData | null,
    deleting: false,
    deleteBusy: false,
    starting: false,

    navigate(path: string) {
      globalThis.location.href = path;
    },

    async init(this: RoutineDetailContext) {
      const routineId = routineIdFromLocation();
      if (!routineId) {
        this.error = "No routine selected.";
        this.loading = false;
        return;
      }
      try {
        this.routine = await getRoutine(routineId);
      } catch {
        this.error = "Could not load this routine.";
      } finally {
        this.loading = false;
      }
    },

    durationLabel(this: RoutineDetailContext): string {
      const total = (this.routine?.steps ?? []).reduce(
        (sum, step) =>
          step.durationTypeKey === "MINUTES" ? sum + step.durationValue : sum,
        0,
      );
      return `${total} min`;
    },

    stepDuration(step: Step): string {
      return step.durationTypeKey === "MINUTES"
        ? `${step.durationValue} min`
        : `${step.durationValue} rounds`;
    },

    canEdit(this: RoutineDetailContext): boolean {
      return this.routine !== null && !this.routine.isSystemTemplate;
    },

    playPath(this: RoutineDetailContext): string {
      return this.routine
        ? routinePlayPath(this.routine.routineId)
        : "/training";
    },

    editPath(this: RoutineDetailContext): string {
      return this.routine
        ? routineEditPath(this.routine.routineId)
        : "/training";
    },

    start(this: RoutineDetailContext) {
      this.starting = true;
      this.navigate(this.playPath());
    },

    requestDelete(this: RoutineDetailContext) {
      this.deleting = true;
    },

    cancelDelete(this: RoutineDetailContext) {
      this.deleting = false;
    },

    async confirmDelete(this: RoutineDetailContext) {
      if (!this.routine || this.deleteBusy) return;
      this.deleteBusy = true;
      try {
        await deleteRoutine(this.routine.routineId);
        this.navigate("/training");
      } catch {
        this.error = "Could not delete this routine.";
        this.deleteBusy = false;
        this.deleting = false;
      }
    },
  };
}

import { listRoutines } from "@client/api/routines";
import { routineSelectOptions } from "./routine-options";
import type { RoutineSummaryData } from "@client/api/types";
import type { SelectOption, StatisticsRoutinesContext } from "./types";

/** `/statistics` Routines tab: loads every routine for its `Select`, seeded to the first option. */
export function statisticsRoutines() {
  return {
    loading: true,
    error: "",
    routines: [] as RoutineSummaryData[],
    routine: "",

    async init(this: StatisticsRoutinesContext) {
      this.loading = true;
      this.error = "";
      try {
        this.routines = (await listRoutines()).items;
        this.routine = this.routineOptions()[0]?.value ?? "";
      } catch {
        this.error =
          "Could not load your routines. Check your connection and reload.";
      } finally {
        this.loading = false;
      }
    },

    routineOptions(this: StatisticsRoutinesContext): SelectOption[] {
      return routineSelectOptions(this.routines);
    },

    routineName(this: StatisticsRoutinesContext): string {
      return (
        this.routines.find((routine) => routine.routineId === this.routine)
          ?.routineName ?? ""
      );
    },
  };
}

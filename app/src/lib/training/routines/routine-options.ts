import type { RoutineSummaryData } from "@client/api/types";
import type { SelectOption } from "./types";

/** Routines as `Select` options: default routines first, then the player's own, load order kept within each. */
export function routineSelectOptions(
  routines: readonly RoutineSummaryData[],
): SelectOption[] {
  return [
    ...routines.filter((routine) => routine.isSystemTemplate),
    ...routines.filter((routine) => !routine.isSystemTemplate),
  ].map((routine) => ({
    value: routine.routineId,
    label: routine.routineName,
  }));
}

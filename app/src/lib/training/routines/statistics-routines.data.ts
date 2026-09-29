import type { SelectOption, StatisticsRoutinesContext } from "./types";

/**
 * `/statistics` Routines tab picker. Its `Select` model reads and writes the
 * `routineStats` store's selected routine, so the picker is seeded with the
 * store's first trained routine (`routineStats.activate()`) and a pick
 * reloads the tab through `selectRoutine`. The options are routines that
 * were trained (`GET /api/statistics/routines`), never the `GET /api/routines`
 * catalogue of routines that exist today (D372 decision 9).
 */
export function statisticsRoutines(): Omit<
  StatisticsRoutinesContext,
  "$store"
> &
  ThisType<StatisticsRoutinesContext> {
  return {
    get routine(): string {
      return this.$store.routineStats.routineKey ?? "";
    },

    set routine(routineKey: string) {
      if (routineKey === this.$store.routineStats.routineKey) return;
      void this.$store.routineStats.selectRoutine(routineKey);
    },

    routineOptions(): SelectOption[] {
      return this.$store.routineStats.routines.map((routine) => ({
        value: routine.routineKey,
        label: routine.routineName,
      }));
    },
  };
}

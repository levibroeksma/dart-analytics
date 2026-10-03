import { statisticsRoute } from "@server/statistics-route";
import { getRoutineStepSection } from "@services/statistics.service";
import { RoutineStatsQuery } from "@routes/types";

/**
 * One routine step's section result (`10-Statistics/00-Overview.md` §6,
 * D372 decisions 4-6): a GAME step's section is one of its game's
 * own (`volume`, `completion`, ...), scoped to that step's sessions with
 * `context = "routine"` fixed server-side; a non-game step's is
 * `step-volume`/`step-result`. One route serves every case -- the service
 * (`getRoutineStepSection`) resolves `routineKey`/`stepKey`/`sectionId`
 * against the routine's own descriptors and returns `VALIDATION_FAILED` for
 * a malformed key or `NOT_FOUND` for an unknown one, a step the routine
 * never ran, or a section outside what that step offers. `context`,
 * `inputMode` and `target` are never accepted here -- `RoutineStatsQuery`'s
 * `.strict()` fails them (D372 decision 4); the client has no way to widen
 * either.
 */
export const GET = statisticsRoute({
  schema: RoutineStatsQuery,
  run: ({ playerId, params }, query) =>
    getRoutineStepSection(
      playerId,
      params.routineKey!,
      params.stepKey!,
      params.sectionId!,
      query,
    ),
});

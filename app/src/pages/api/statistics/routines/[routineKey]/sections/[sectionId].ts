import { statisticsRoute } from "@server/statistics-route";
import { getRoutineSection } from "@services/statistics.service";
import { RoutineStatsQuery } from "@routes/types";

/**
 * One routine's run-level section result (`routine-volume`/
 * `routine-completion`, `10-Statistics/00-Overview.md` §6, D372 decision
 * 6). One route serves both sections; `routineKey` and `sectionId` are
 * validated by the service (`isRoutineKey`, `sectionsForRoutine`): a
 * malformed key is `VALIDATION_FAILED` without a repository call, while a
 * routine the caller never trained or an unknown section is `NOT_FOUND`
 * once `findRoutineHeader` has read the routine. `context`, `inputMode` and
 * `target` are never accepted here -- `RoutineStatsQuery.strict()` fails
 * them (D372 decision 4).
 */
export const GET = statisticsRoute({
  schema: RoutineStatsQuery,
  run: ({ playerId, params }, query) =>
    getRoutineSection(playerId, params.routineKey!, params.sectionId!, query),
});

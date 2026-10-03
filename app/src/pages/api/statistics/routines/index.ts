import { statisticsRoute } from "@server/statistics-route";
import { listTrainedRoutines } from "@services/statistics.service";
import { RoutineNoQuery } from "@routes/types";

/**
 * Every routine the caller has trained, newest run first
 * (`10-Statistics/00-Overview.md` §6, D372 decision 9).
 * Unpaginated -- bounded by routines trained, not by runs. Takes no query
 * parameters: any key at all fails `RoutineNoQuery`'s `.strict()`.
 */
export const GET = statisticsRoute({
  schema: RoutineNoQuery,
  run: ({ playerId }) => listTrainedRoutines(playerId),
});

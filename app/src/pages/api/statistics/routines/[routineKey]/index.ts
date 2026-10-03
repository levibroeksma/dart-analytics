import { statisticsRoute } from "@server/statistics-route";
import { getRoutineHeader } from "@services/statistics.service";
import { RoutineNoQuery } from "@routes/types";

/**
 * One routine's header: its own identity and run counts, its `dataVersion`,
 * and every step it has ever run (`10-Statistics/00-Overview.md` §6, D372
 * decision 9). `routineKey`'s own shape is validated by the service
 * (`isRoutineKey`), so a malformed key surfaces as `VALIDATION_FAILED`
 * without a repository call, and an unknown or unowned one as `NOT_FOUND`.
 * Takes no query parameters: any key at all fails `RoutineNoQuery`'s
 * `.strict()`.
 */
export const GET = statisticsRoute({
  schema: RoutineNoQuery,
  run: ({ playerId, params }) => getRoutineHeader(playerId, params.routineKey!),
});

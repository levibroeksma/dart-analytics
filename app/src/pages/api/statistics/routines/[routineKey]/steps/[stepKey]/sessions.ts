import { statisticsRoute } from "@server/statistics-route";
import { listRoutineStepSessions } from "@services/statistics.service";
import { RoutineSessionsQuery } from "@routes/types";

/**
 * One step's paginated session list, newest first
 * (`10-Statistics/00-Overview.md` §6, D372 decision 10), over
 * `v_stats_routine_step_facts`. `routineKey`/`stepKey` are validated by the
 * service: a malformed key is `VALIDATION_FAILED` without a repository
 * call, while an unknown routine or a step the routine never ran is
 * `NOT_FOUND` once `findRoutineHeader` and the step descriptors have been
 * read. `context` and `inputMode` are never accepted here -- a step's
 * sessions are routine context by definition, so `RoutineSessionsQuery`'s
 * `.strict()` fails them (D372 decision 4).
 */
export const GET = statisticsRoute({
  schema: RoutineSessionsQuery,
  run: ({ playerId, params }, query) =>
    listRoutineStepSessions(
      playerId,
      params.routineKey!,
      params.stepKey!,
      query,
    ),
});

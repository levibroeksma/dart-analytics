import { statisticsRoute } from "@server/statistics-route";
import { getSessionReplay } from "@services/statistics.service";
import { ReplayQuery, ReplaySessionIdParam } from "@routes/types";

/**
 * One page of a session's replay (`10-Statistics/00-Overview.md` §7, D371
 * decisions 2-7). `sessionId` is checked as a UUID before the service's own
 * gate ever runs, so a malformed id fails validation instead of surfacing
 * as a database error. Only `cursor` and `limit` are read off the query
 * string -- any other search param fails `ReplayQuery`'s `.strict()`
 * (decision 6). Every response, page or error, is `private, no-store`
 * (decision 7): the client's `replayPages` store is the only cache.
 */
export const GET = statisticsRoute({
  schema: ReplayQuery,
  guard: ({ sessionId }) =>
    ReplaySessionIdParam.safeParse(sessionId).success
      ? null
      : {
          code: "VALIDATION_FAILED",
          details: { reason: "sessionId must be a UUID" },
        },
  run: ({ playerId, params }, query) =>
    getSessionReplay(playerId, params.sessionId!, {
      cursor: query.cursor ?? null,
      limit: query.limit,
    }),
});

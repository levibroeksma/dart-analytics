import type { APIRoute } from "astro";
import { getSessionReplay } from "@services/statistics.service";
import { ok, fail } from "@server/envelope";
import { ReplayQuery, ReplaySessionIdParam } from "@routes/types";

/**
 * `response`, marked `private, no-store`: decision 7 sends it on every
 * response of this route, page or error, so no replay page lands in the
 * browser's HTTP cache, which sign-out does not wipe.
 */
function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * One page of a session's replay (`10-Statistics/00-Overview.md` §7, D371
 * decisions 2-7). `sessionId` is checked as a UUID before the service's own
 * gate ever runs, so a malformed id fails validation instead of surfacing
 * as a database error. Only `cursor` and `limit` are read off the query
 * string -- any other search param fails `ReplayQuery`'s `.strict()`
 * (decision 6). Every response, page or error, is `private, no-store`
 * (decision 7): the client's `replayPages` store is the only cache.
 */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const auth = locals.auth!;
  const sessionId = params.sessionId!;

  if (!ReplaySessionIdParam.safeParse(sessionId).success) {
    return noStore(
      fail("VALIDATION_FAILED", locals.requestId, {
        reason: "sessionId must be a UUID",
      }),
    );
  }

  const parsed = ReplayQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return noStore(
      fail("VALIDATION_FAILED", locals.requestId, {
        reason: parsed.error.issues[0]?.message ?? "invalid query",
      }),
    );
  }

  const result = await getSessionReplay(auth.playerId!, sessionId, {
    cursor: parsed.data.cursor ?? null,
    limit: parsed.data.limit,
  });
  if (!result.ok)
    return noStore(fail(result.code, locals.requestId, result.details));

  return noStore(ok(result.data, locals.requestId));
};

import type { APIRoute } from "astro";
import { getSessionReplay } from "@services/statistics.service";
import { ok, fail } from "@server/envelope";
import { ReplayQuery, ReplaySessionIdParam } from "@routes/types";
import type { ErrorCode } from "@server/types";

/** `fail`, with the error `Cache-Control` decision 7 requires on every error path of this route. */
function failNoStore(
  code: ErrorCode,
  requestId: string,
  details?: Record<string, unknown>,
): Response {
  const response = fail(code, requestId, details);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * One page of a session's replay (`10-Statistics/00-Overview.md` §7, D371
 * decisions 2-7). `sessionId` is checked as a UUID before the service's own
 * gate ever runs, so a malformed id fails validation instead of surfacing
 * as a database error. Only `cursor` and `limit` are read off the query
 * string -- any other search param fails `ReplayQuery`'s `.strict()`
 * (decision 6). Only a successful page is cached immutably; every error
 * keeps `private, no-store` (decision 7).
 */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const auth = locals.auth!;
  const sessionId = params.sessionId!;

  if (!ReplaySessionIdParam.safeParse(sessionId).success) {
    return failNoStore("VALIDATION_FAILED", locals.requestId, {
      reason: "sessionId must be a UUID",
    });
  }

  const parsed = ReplayQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return failNoStore("VALIDATION_FAILED", locals.requestId, {
      reason: parsed.error.issues[0]?.message ?? "invalid query",
    });
  }

  const result = await getSessionReplay(auth.playerId!, sessionId, {
    cursor: parsed.data.cursor ?? null,
    limit: parsed.data.limit,
  });
  if (!result.ok)
    return failNoStore(result.code, locals.requestId, result.details);

  const response = ok(result.data, locals.requestId);
  response.headers.set("Cache-Control", "private, max-age=31536000, immutable");
  return response;
};

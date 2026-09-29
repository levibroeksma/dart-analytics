import type { APIRoute } from "astro";
import { listTrainedRoutines } from "@services/statistics.service";
import { ok, fail } from "@server/envelope";
import { RoutineNoQuery } from "@routes/types";

/**
 * Every routine the caller has trained, newest run first
 * (`10-Statistics/00-Overview.md` §6, D372 decision 9).
 * Unpaginated -- bounded by routines trained, not by runs. Takes no query
 * parameters: any key at all fails `RoutineNoQuery`'s `.strict()`.
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const auth = locals.auth!;

  const parsed = RoutineNoQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: parsed.error.issues[0]?.message ?? "invalid query",
    });
  }

  const result = await listTrainedRoutines(auth.playerId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  const response = ok(result.data, locals.requestId);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

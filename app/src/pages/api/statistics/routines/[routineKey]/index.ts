import type { APIRoute } from "astro";
import { getRoutineHeader } from "@services/statistics.service";
import { ok, fail } from "@server/envelope";
import { RoutineNoQuery } from "@routes/types";

/**
 * One routine's header: its own identity and run counts, its `dataVersion`,
 * and every step it has ever run (`10-Statistics/00-Overview.md` §9, phase
 * 6b plan decision 9). `routineKey`'s own shape is validated by the service
 * (`isRoutineKey`), so a malformed key surfaces as `VALIDATION_FAILED`
 * without a repository call, and an unknown or unowned one as `NOT_FOUND`.
 * Takes no query parameters: any key at all fails `RoutineNoQuery`'s
 * `.strict()`.
 */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const auth = locals.auth!;
  const routineKey = params.routineKey!;

  const parsed = RoutineNoQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: parsed.error.issues[0]?.message ?? "invalid query",
    });
  }

  const result = await getRoutineHeader(auth.playerId!, routineKey);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  const response = ok(result.data, locals.requestId);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

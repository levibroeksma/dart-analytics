import type { APIRoute } from "astro";
import { listRoutineStepSessions } from "@services/statistics.service";
import { ok, fail } from "@server/envelope";
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
export const GET: APIRoute = async ({ locals, params, url }) => {
  const auth = locals.auth!;
  const routineKey = params.routineKey!;
  const stepKey = params.stepKey!;

  const parsed = RoutineSessionsQuery.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: parsed.error.issues[0]?.message ?? "invalid query",
    });
  }

  const result = await listRoutineStepSessions(
    auth.playerId!,
    routineKey,
    stepKey,
    parsed.data,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  const response = ok(result.data, locals.requestId);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

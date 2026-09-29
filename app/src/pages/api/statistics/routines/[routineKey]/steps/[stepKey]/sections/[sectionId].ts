import type { APIRoute } from "astro";
import { getRoutineStepSection } from "@services/statistics.service";
import { ok, fail } from "@server/envelope";
import { RoutineStatsQuery } from "@routes/types";

/**
 * One routine step's section result (`10-Statistics/00-Overview.md` §6,
 * phase 6b plan decisions 4-6): a GAME step's section is one of its game's
 * own (`volume`, `completion`, ...), scoped to that step's sessions with
 * `context = "routine"` fixed server-side; a non-game step's is
 * `step-volume`/`step-result`. One route serves every case -- the service
 * (`getRoutineStepSection`) resolves `routineKey`/`stepKey`/`sectionId`
 * against the routine's own descriptors and returns `VALIDATION_FAILED` for
 * a malformed key or `NOT_FOUND` for an unknown one, a step the routine
 * never ran, or a section outside what that step offers. `context`,
 * `inputMode` and `target` are never accepted here -- `RoutineStatsQuery`'s
 * `.strict()` fails them (plan decision 4); the client has no way to widen
 * either.
 */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const auth = locals.auth!;
  const routineKey = params.routineKey!;
  const stepKey = params.stepKey!;
  const sectionId = params.sectionId!;

  const parsed = RoutineStatsQuery.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: parsed.error.issues[0]?.message ?? "invalid query",
    });
  }

  const result = await getRoutineStepSection(
    auth.playerId!,
    routineKey,
    stepKey,
    sectionId,
    parsed.data,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  const response = ok(result.data, locals.requestId);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

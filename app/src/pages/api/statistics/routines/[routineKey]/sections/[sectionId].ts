import type { APIRoute } from "astro";
import { getRoutineSection } from "@services/statistics.service";
import { ok, fail } from "@server/envelope";
import { RoutineStatsQuery } from "@routes/types";

/**
 * One routine's run-level section result (`routine-volume`/
 * `routine-completion`, `10-Statistics/00-Overview.md` §6, phase 6b plan
 * decision 6). One route serves both sections; `routineKey` and `sectionId`
 * are validated by the service (`isRoutineKey`, `sectionsForRoutine`), so a
 * malformed key or an unknown section surface as `VALIDATION_FAILED`/
 * `NOT_FOUND` without a repository call. `context`, `inputMode` and `target`
 * are never accepted here -- `RoutineStatsQuery.strict()` fails them (plan
 * decision 4).
 */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const auth = locals.auth!;
  const routineKey = params.routineKey!;
  const sectionId = params.sectionId!;

  const parsed = RoutineStatsQuery.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: parsed.error.issues[0]?.message ?? "invalid query",
    });
  }

  const result = await getRoutineSection(
    auth.playerId!,
    routineKey,
    sectionId,
    parsed.data,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  const response = ok(result.data, locals.requestId);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

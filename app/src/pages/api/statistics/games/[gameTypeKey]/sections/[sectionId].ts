import type { APIRoute } from "astro";
import { isGameTypeKey } from "@lib/game/rulesets/capabilities";
import { isSectionId } from "@lib/stats/section-registry";
import { getGameSection } from "@services/statistics.service";
import { ok, fail } from "@server/envelope";
import { StatisticsRangeQuery } from "@routes/types";

/**
 * One section result for a game page, dispatched through the registry
 * (`00-Overview.md` §2, §6). One route serves every section; adding an
 * insight never adds a route.
 */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const auth = locals.auth!;
  const gameTypeKey = params.gameTypeKey!;
  const sectionId = params.sectionId!;
  if (!isGameTypeKey(gameTypeKey)) {
    return fail("NOT_FOUND", locals.requestId);
  }
  if (!isSectionId(sectionId)) {
    return fail("NOT_FOUND", locals.requestId);
  }

  const parsed = StatisticsRangeQuery.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    tz: url.searchParams.get("tz") ?? undefined,
    bucket: url.searchParams.get("bucket") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    context: url.searchParams.get("context") ?? undefined,
    inputMode: url.searchParams.get("inputMode") ?? undefined,
  });
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: parsed.error.issues[0]?.message ?? "invalid query",
    });
  }

  const result = await getGameSection(
    auth.playerId!,
    gameTypeKey,
    sectionId,
    parsed.data,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  const response = ok(result.data, locals.requestId);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

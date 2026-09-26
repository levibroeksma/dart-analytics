import type { APIRoute } from "astro";
import { isGameTypeKey } from "@lib/game/rulesets/capabilities";
import { listGameSessions } from "@services/statistics.service";
import { ok, fail } from "@server/envelope";
import { SessionListQuery } from "@routes/types";

/** The caller's paginated session list for a game page (`00-Overview.md` §6). */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const auth = locals.auth!;
  const gameTypeKey = params.gameTypeKey!;
  if (!isGameTypeKey(gameTypeKey)) {
    return fail("NOT_FOUND", locals.requestId);
  }

  const parsed = SessionListQuery.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    tz: url.searchParams.get("tz") ?? undefined,
    bucket: url.searchParams.get("bucket") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    context: url.searchParams.get("context") ?? undefined,
    inputMode: url.searchParams.get("inputMode") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: parsed.error.issues[0]?.message ?? "invalid query",
    });
  }

  const result = await listGameSessions(
    auth.playerId!,
    gameTypeKey,
    parsed.data,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  const response = ok(result.data, locals.requestId);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

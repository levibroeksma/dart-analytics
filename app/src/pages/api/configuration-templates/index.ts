import type { APIRoute } from "astro";
import { listConfigurationPresets } from "@services/session.service";
import { ok, fail } from "@server/envelope";

export const GET: APIRoute = async ({ locals, url }) => {
  const auth = locals.auth!;
  const gameType = url.searchParams.get("gameType");
  if (!gameType) {
    return fail("VALIDATION_FAILED", locals.requestId, { reason: "gameType query param is required" });
  }
  const rows = await listConfigurationPresets(auth.playerId!, gameType);
  return ok(rows, locals.requestId);
};

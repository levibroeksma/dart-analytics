import type { APIRoute } from "astro";
import { getActiveSchedule } from "@services/schedule.service";
import { ok, fail } from "@server/envelope";

/** Convenience read for the Today card: the caller's active schedule, or `null` when none is active. */
export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const result = await getActiveSchedule(auth.playerId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

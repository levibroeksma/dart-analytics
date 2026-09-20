import type { APIRoute } from "astro";
import { deactivateSchedule } from "@services/schedule.service";
import { ok, fail } from "@server/envelope";

export const POST: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const result = await deactivateSchedule(auth.playerId!, params.scheduleId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

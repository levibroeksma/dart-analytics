import type { APIRoute } from "astro";
import { completeTraining } from "@services/training-session.service";
import { ok, fail } from "@server/envelope";

export const PATCH: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const activityId = params.activityId!;

  const result = await completeTraining(auth.playerId!, activityId);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

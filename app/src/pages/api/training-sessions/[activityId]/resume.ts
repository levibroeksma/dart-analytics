import type { APIRoute } from "astro";
import { resumeTraining } from "@services/training-session.service";
import { ok, fail } from "@server/envelope";

export const POST: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const activityId = params.activityId!;

  const result = await resumeTraining(auth.playerId!, activityId);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

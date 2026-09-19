import type { APIRoute } from "astro";
import { listExerciseTemplates } from "@services/routine.service";
import { ok, fail } from "@server/envelope";

export const GET: APIRoute = async ({ locals }) => {
  const result = await listExerciseTemplates();
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

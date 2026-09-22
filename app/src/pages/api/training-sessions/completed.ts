import type { APIRoute } from "astro";
import { TrainingCompletionsQuery } from "./types";
import { listTrainingCompletions } from "@services/training-session.service";
import { ok, fail } from "@server/envelope";

/** The caller's completed trainings since `?since=<ISO instant>`, newest first. */
export const GET: APIRoute = async ({ locals, url }) => {
  const auth = locals.auth!;
  const parsed = TrainingCompletionsQuery.safeParse({
    since: url.searchParams.get("since") ?? undefined,
  });
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: "since must be an ISO 8601 instant",
    });
  }
  const result = await listTrainingCompletions(
    auth.playerId!,
    parsed.data.since,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

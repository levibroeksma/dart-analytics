import type { APIRoute } from "astro";
import { startTrainingStep } from "@services/training-session.service";
import { ok, fail } from "@server/envelope";

export const POST: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const activityId = params.activityId!;
  const sequenceNumber = Number(params.sequenceNumber);
  if (!Number.isInteger(sequenceNumber)) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: "sequenceNumber must be an integer",
    });
  }

  const result = await startTrainingStep(
    auth.playerId!,
    activityId,
    sequenceNumber,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId, 201);
};

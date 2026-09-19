import type { APIRoute } from "astro";
import { StartTrainingRequest } from "./types";
import { startTraining } from "@services/training-session.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;
  const parsed = await parseAndValidateBody(
    StartTrainingRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await startTraining(
    auth.playerId!,
    parsed.data.routineTemplateId,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId, 201);
};

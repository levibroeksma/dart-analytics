import type { APIRoute } from "astro";
import { EventsBatchRequest } from "../../types";
import { appendBatch } from "@services/session.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const auth = locals.auth!;
  const sessionId = params.sessionId!;
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: "Idempotency-Key header is required",
    });
  }

  const parsed = await parseAndValidateBody(
    EventsBatchRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await appendBatch(
    auth.playerId!,
    sessionId,
    idempotencyKey,
    parsed.data,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

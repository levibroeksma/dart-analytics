import type { APIRoute } from "astro";
import { EventsBatchRequest } from "../../types";
import { appendBatch } from "@services/session.service";
import { ok, fail } from "@server/envelope";
import { parseJsonBody } from "@server/parse-json-body";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const auth = locals.auth!;
  const sessionId = params.sessionId!;
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return fail("VALIDATION_FAILED", locals.requestId, { reason: "Idempotency-Key header is required" });
  }

  const parsedBody = parseJsonBody(await request.text());
  if (!parsedBody.ok) {
    return fail("VALIDATION_FAILED", locals.requestId, { reason: "body is not valid JSON" });
  }
  const parsed = EventsBatchRequest.safeParse(parsedBody.value);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, { issues: parsed.error.issues });
  }

  const result = await appendBatch(auth.playerId!, sessionId, idempotencyKey, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

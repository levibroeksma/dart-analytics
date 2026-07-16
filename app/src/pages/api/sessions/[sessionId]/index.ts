import type { APIRoute } from "astro";
import { UpdateSessionRequest } from "../types";
import { updateSessionStatus } from "@services/session.service";
import { ok, fail } from "@server/envelope";
import { parseJsonBody } from "@server/parse-json-body";

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const auth = locals.auth!;
  const sessionId = params.sessionId!;

  const parsedBody = parseJsonBody(await request.text());
  if (!parsedBody.ok) {
    return fail("VALIDATION_FAILED", locals.requestId, { reason: "body is not valid JSON" });
  }
  const parsed = UpdateSessionRequest.safeParse(parsedBody.value);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, { issues: parsed.error.issues });
  }

  const result = await updateSessionStatus(auth.playerId!, sessionId, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

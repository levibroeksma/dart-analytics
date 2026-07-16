import type { APIRoute } from "astro";
import { CreateSessionRequest } from "./types";
import { createSession } from "@services/session.service";
import { ok, fail } from "@server/envelope";
import { parseJsonBody } from "@server/parse-json-body";

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;

  const parsedBody = parseJsonBody(await request.text());
  if (!parsedBody.ok) {
    return fail("VALIDATION_FAILED", locals.requestId, { reason: "body is not valid JSON" });
  }
  const parsed = CreateSessionRequest.safeParse(parsedBody.value);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, { issues: parsed.error.issues });
  }

  const result = await createSession(auth.playerId!, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId, 201);
};

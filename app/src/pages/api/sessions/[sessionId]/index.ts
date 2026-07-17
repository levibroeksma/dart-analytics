import type { APIRoute } from "astro";
import { UpdateSessionRequest } from "../types";
import { updateSessionStatus } from "@services/session.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const auth = locals.auth!;
  const sessionId = params.sessionId!;

  const parsed = await parseAndValidateBody(UpdateSessionRequest, request, locals.requestId);
  if (!parsed.ok) return parsed.response;

  const result = await updateSessionStatus(auth.playerId!, sessionId, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

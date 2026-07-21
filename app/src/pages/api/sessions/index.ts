import type { APIRoute } from "astro";
import { CreateSessionRequest } from "./types";
import { createSession } from "@services/session.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;

  const parsed = await parseAndValidateBody(
    CreateSessionRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await createSession(auth.playerId!, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId, 201);
};

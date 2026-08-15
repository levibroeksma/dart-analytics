import type { APIRoute } from "astro";
import { UpdatePlayerProfileRequest } from "@routes/types";
import { readProfile, writeProfile } from "@services/player.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

/**
 * Returns the caller's display name and darts equipment. Middleware
 * guarantees `playerId`.
 */
export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const profile = await readProfile(auth.playerId!);
  return ok(profile, locals.requestId);
};

/**
 * Replaces the caller's display name and darts equipment. No partial
 * update — all three fields are always sent together.
 */
export const PATCH: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;

  const parsed = await parseAndValidateBody(
    UpdatePlayerProfileRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await writeProfile(auth.playerId!, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

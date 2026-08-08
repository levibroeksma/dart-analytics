import type { APIRoute } from "astro";
import { UpdatePlayerSettingsRequest } from "@routes/types";
import { readSettings, writeSettings } from "@services/settings.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

/**
 * Returns the caller's default capture and input modes. Middleware guarantees
 * `playerId`; a player with no settings row gets the service defaults.
 */
export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const settings = await readSettings(auth.playerId!);
  return ok(settings, locals.requestId);
};

/**
 * Replaces the caller's default capture and input modes. A pair no ruleset
 * version supports is refused with VALIDATION_FAILED.
 */
export const PATCH: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;

  const parsed = await parseAndValidateBody(
    UpdatePlayerSettingsRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await writeSettings(auth.playerId!, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

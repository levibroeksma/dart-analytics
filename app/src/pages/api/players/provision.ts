import type { APIRoute } from "astro";
import { ProvisionPlayerRequest } from "./types";
import { provisionPlayer } from "@services/player.service";
import { ok } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

/**
 * Provisions a player for the authenticated-unprovisioned caller. Middleware
 * guarantees `authUserId`. displayName resolution (D76): request body → JWT name
 * claim → service default `'Player'`.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;

  const parsed = await parseAndValidateBody(ProvisionPlayerRequest, request, locals.requestId);
  if (!parsed.ok) return parsed.response;

  const displayName = parsed.data.displayName ?? auth.name;
  const provisioned = await provisionPlayer(auth.authUserId, displayName);
  return ok(provisioned, locals.requestId);
};

import type { APIRoute } from "astro";
import { ProvisionPlayerRequest } from "./types";
import { provisionPlayer } from "@services/player.service";
import { ok } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const POST: APIRoute = async ({ locals, request }) => {
  // Middleware guarantees authUserId on this route (authenticated-unprovisioned class).
  const auth = locals.auth!;

  const parsed = await parseAndValidateBody(ProvisionPlayerRequest, request, locals.requestId);
  if (!parsed.ok) return parsed.response;

  // D76 resolution: request displayName → JWT name claim → 'Player' (service default)
  const displayName = parsed.data.displayName ?? auth.name;
  const provisioned = await provisionPlayer(auth.authUserId, displayName);
  return ok(provisioned, locals.requestId);
};

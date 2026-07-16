import type { APIRoute } from "astro";
import { ProvisionPlayerRequest } from "./types";
import { provisionPlayer } from "@services/player.service";
import { ok, fail } from "@server/envelope";
import { parseJsonBody } from "@server/parse-json-body";

export const POST: APIRoute = async ({ locals, request }) => {
  // Middleware guarantees authUserId on this route (authenticated-unprovisioned class).
  const auth = locals.auth!;

  const parsedBody = parseJsonBody(await request.text());
  if (!parsedBody.ok) {
    return fail("VALIDATION_FAILED", locals.requestId, { reason: "body is not valid JSON" });
  }

  const parsed = ProvisionPlayerRequest.safeParse(parsedBody.value);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, { issues: parsed.error.issues });
  }

  // D76 resolution: request displayName → JWT name claim → 'Player' (service default)
  const displayName = parsed.data.displayName ?? auth.name;
  const provisioned = await provisionPlayer(auth.authUserId, displayName);
  return ok(provisioned, locals.requestId);
};

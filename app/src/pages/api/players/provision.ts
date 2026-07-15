import type { APIRoute } from "astro";
import { z } from "zod";
import { provisionPlayer } from "../../../services/player.service";
import { ok, fail } from "../../../lib/server/envelope";

/** Frozen contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Player Provisioning. */
const ProvisionPlayerRequest = z.object({
  displayName: z.string().min(1).optional(),
});

export const POST: APIRoute = async ({ locals, request }) => {
  // Middleware guarantees authUserId on this route (authenticated-unprovisioned class).
  const auth = locals.auth!;

  let body: unknown = {};
  const raw = await request.text();
  if (raw.trim().length > 0) {
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("VALIDATION_FAILED", locals.requestId, { reason: "body is not valid JSON" });
    }
  }
  const parsed = ProvisionPlayerRequest.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, { issues: parsed.error.issues });
  }

  // D76 resolution: request displayName → JWT name claim → 'Player' (service default)
  const displayName = parsed.data.displayName ?? auth.name;
  const provisioned = await provisionPlayer(auth.authUserId, displayName);
  return ok(provisioned, locals.requestId);
};

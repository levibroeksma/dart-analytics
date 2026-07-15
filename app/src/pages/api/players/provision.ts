import type { APIRoute } from "astro";
import { z } from "zod";
import { provisionPlayer } from "../../../services/player.service";
import { ok, fail } from "../../../lib/server/envelope";

/** Frozen contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Player Provisioning. */
const ProvisionPlayerRequest = z.object({
  displayName: z.string().min(1).optional(),
});

/**
 * Parses a raw request body into an `unknown` JSON value.
 * An empty (whitespace-only) body resolves to `{}`. Malformed JSON is
 * reported via `ok: false` rather than throwing.
 */
function parseJsonBody(raw: string): { ok: true; value: unknown } | { ok: false } {
  if (raw.trim().length === 0) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

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

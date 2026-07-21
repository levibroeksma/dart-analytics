import type { APIRoute } from "astro";
import { listActiveSessions } from "@services/session.service";
import { ok } from "@server/envelope";

export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const rows = await listActiveSessions(auth.playerId!);
  return ok(rows, locals.requestId);
};

import type { APIRoute } from "astro";
import { getStatisticsOverview } from "@services/statistics.service";
import { ok } from "@server/envelope";

/**
 * Career-wide stat overview for the caller. Every field is always present;
 * null means "not enough data to compute," never "not implemented."
 */
export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const overview = await getStatisticsOverview(auth.playerId!);
  return ok(overview, locals.requestId);
};

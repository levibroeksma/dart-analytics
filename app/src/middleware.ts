import type { MiddlewareHandler } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { players } from "./db/schema";
import { verifyBearerToken } from "./lib/auth/verify-jwt";
import { fail } from "./lib/server/envelope";
import { classifyRoute } from "./lib/utils/route-class";

/**
 * Route-class auth gate. `api-provision` (D62): JWT verified, player lookup
 * skipped — authenticated-unprovisioned. `protected-page` (D97/D98): HTML never
 * carries Bearer; prerendered shells bypass middleware in production; redirecting
 * in dev causes a / ↔ /login loop after client login — navigation UX is
 * enforced by auth.store init(), not here.
 */
export const onRequest: MiddlewareHandler = async (ctx, next) => {
  ctx.locals.requestId = crypto.randomUUID();
  const cls = classifyRoute(ctx.url.pathname);

  if (cls === "public-page" || cls === "asset") return next();

  const verified = await verifyBearerToken(
    ctx.request.headers.get("authorization"),
  );

  if (cls === "api-provision" || cls === "api-protected") {
    if (!verified) return fail("UNAUTHORIZED", ctx.locals.requestId);

    if (cls === "api-provision") {
      ctx.locals.auth = {
        authUserId: verified.authUserId,
        ...(verified.name ? { name: verified.name } : {}),
      };
      return next();
    }

    const db = getDb();
    const [player] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.authUserId, verified.authUserId))
      .limit(1);
    if (!player) return fail("PLAYER_NOT_PROVISIONED", ctx.locals.requestId);

    ctx.locals.auth = { authUserId: verified.authUserId, playerId: player.id };
    return next();
  }

  if (cls === "protected-page") return next();

  return next();
};

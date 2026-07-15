import type { MiddlewareHandler } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { players } from "./db/schema";
import { verifyBearerToken } from "./lib/auth/verify-jwt";
import { fail } from "./lib/server/envelope";
import { classifyRoute } from "./utils/route-class";

export const onRequest: MiddlewareHandler = async (ctx, next) => {
  ctx.locals.requestId = crypto.randomUUID();
  const cls = classifyRoute(ctx.url.pathname);

  if (cls === "public-page" || cls === "asset") return next();

  const verified = await verifyBearerToken(ctx.request.headers.get("authorization"));

  if (cls === "api-provision" || cls === "api-protected") {
    if (!verified) return fail("UNAUTHORIZED", ctx.locals.requestId);

    if (cls === "api-provision") {
      // authenticated-unprovisioned: JWT verified, player resolution skipped (D62)
      ctx.locals.auth = { authUserId: verified.authUserId, ...(verified.name ? { name: verified.name } : {}) };
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

  // protected-page: navigation gate only — HTML requests carry no Bearer header,
  // so this redirect is the documented nav gate, not authentication (see plan
  // Global Constraints / Task 1 outcome). Data is fetched client-side with JWT.
  if (!verified) return ctx.redirect("/login");
  ctx.locals.auth = { authUserId: verified.authUserId };
  return next();
};

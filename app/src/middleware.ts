import type { MiddlewareHandler } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { players } from "./db/schema";
import { verifyBearerToken } from "./lib/auth/verify-jwt";

const JSON_HEADERS = { "Content-Type": "application/json" };

export const onRequest: MiddlewareHandler = async (ctx, next) => {
  ctx.locals.requestId = crypto.randomUUID();

  const verified = await verifyBearerToken(
    ctx.request.headers.get("authorization"),
  );

  if (verified) {
    const db = getDb();
    const [player] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.authUserId, verified.authUserId))
      .limit(1);

    ctx.locals.auth = {
      authUserId: verified.authUserId,
      ...(player ? { playerId: player.id } : {}),
    };
  }

  const path = ctx.url.pathname;

  if (path.startsWith("/profile") && !ctx.locals.auth?.authUserId) {
    return ctx.redirect("/login");
  }

  if (
    path.startsWith("/api/") &&
    !path.startsWith("/api/players/provision") &&
    ctx.locals.auth?.authUserId &&
    !ctx.locals.auth.playerId
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "PLAYER_NOT_PROVISIONED",
          message: "Player profile not provisioned",
          retryable: false,
          details: {},
        },
        requestId: ctx.locals.requestId,
      }),
      { status: 403, headers: JSON_HEADERS },
    );
  }

  return next();
};

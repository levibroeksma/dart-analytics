import type { MiddlewareHandler } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { players } from "./db/schema";
import { verifyBearerToken } from "./lib/auth/verify-jwt";
import { fail } from "./lib/server/envelope";
import { classifyThrownError } from "./lib/server/classify-error";
import { classifyRoute } from "./lib/utils/route-class";

type Ctx = Parameters<MiddlewareHandler>[0];
type Next = Parameters<MiddlewareHandler>[1];

/**
 * Resolves identity for the two API route classes and runs the handler.
 * `api-provision` (D62): JWT verified, player lookup skipped. `api-protected`:
 * JWT verified and player resolved. Any error thrown here (including inside the
 * downstream handler via next()) propagates to the boundary in onRequest.
 */
async function handleApiRequest(
  ctx: Ctx,
  next: Next,
  cls: "api-provision" | "api-protected",
): Promise<Response> {
  const verified = await verifyBearerToken(
    ctx.request.headers.get("authorization"),
  );
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

/**
 * Route-class auth gate with an API error boundary. On `api-*` routes an
 * uncaught error is classified (D131) to SERVICE_UNAVAILABLE (transient) or
 * INTERNAL_ERROR and returned in the frozen envelope with requestId; the raw
 * error is logged server-side, never sent to the client. Page routes
 * (D97/D98) bypass the boundary — navigation UX is enforced by auth.store
 * init(), not here.
 */
export const onRequest: MiddlewareHandler = async (ctx, next) => {
  ctx.locals.requestId = crypto.randomUUID();
  const cls = classifyRoute(ctx.url.pathname);

  if (cls === "public-page" || cls === "asset") return next();

  if (cls === "api-provision" || cls === "api-protected") {
    try {
      return await handleApiRequest(ctx, next, cls);
    } catch (error) {
      console.error(
        `[api] uncaught error requestId=${ctx.locals.requestId}`,
        error,
      );
      return fail(classifyThrownError(error), ctx.locals.requestId);
    }
  }

  return next();
};

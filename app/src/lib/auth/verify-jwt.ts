import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@lib/env";
import type { VerifiedAuth } from "./types";

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/**
 * Astro's static build executes this module during prerendering, where no
 * Neon runtime vars are present (those are Worker-only secrets). Deferring
 * JWKS construction to first real verification keeps prerendering from
 * throwing on `env.auth.jwksUrl`.
 */
function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  jwks ??= createRemoteJWKSet(new URL(env.auth.jwksUrl));
  return jwks;
}

/**
 * Verifies a Neon Auth bearer JWT. Requires a string `sub` and numeric `exp`
 * claim. Returns null on any failure (missing Bearer, invalid signature,
 * expired, malformed) — the 401 mapping is middleware's job (06-API/02 failure
 * table); this function must never throw an invalid token into a 500.
 */
export async function verifyBearerToken(
  authorizationHeader: string | null,
): Promise<VerifiedAuth | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      algorithms: ["EdDSA", "RS256", "ES256"],
    });
    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) return null;
    if (typeof payload.exp !== "number") return null;
    return {
      authUserId: sub,
      ...(typeof payload.name === "string" && payload.name
        ? { name: payload.name }
        : {}),
    };
  } catch {
    return null;
  }
}

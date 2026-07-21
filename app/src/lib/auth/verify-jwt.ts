import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@lib/env";
import type { VerifiedAuth } from "./types";

const jwks = createRemoteJWKSet(new URL(env.auth.jwksUrl));

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
    const { payload } = await jwtVerify(token, jwks, {
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

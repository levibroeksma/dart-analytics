import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@lib/env";

const jwks = createRemoteJWKSet(new URL(env.auth.jwksUrl));

export type VerifiedAuth = {
  authUserId: string;
  /** Optional display-name claim, used only by provisioning (D76). */
  name?: string;
};

/**
 * Verifies a Neon Auth bearer JWT. Returns null on ANY failure —
 * the 401 mapping is middleware's job (06-API/02 failure table); this
 * function must never throw an invalid token into a 500.
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
    if (typeof payload.exp !== "number") return null; // jose enforced expiry; claim must exist
    return {
      authUserId: sub,
      ...(typeof payload.name === "string" && payload.name ? { name: payload.name } : {}),
    };
  } catch {
    return null; // invalid signature, expired, malformed — all map to 401 upstream
  }
}

import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env";

const jwks = createRemoteJWKSet(new URL(env.auth.jwksUrl));

export type VerifiedAuth = {
  authUserId: string;
};

/**
 * Verifies a Neon Auth bearer JWT and returns the auth user id (`sub`).
 */
export async function verifyBearerToken(
  authorizationHeader: string | null,
): Promise<VerifiedAuth | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;

  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ["EdDSA", "RS256", "ES256"],
  });

  const sub = payload.sub;
  const exp = payload.exp;
  if (typeof sub !== "string" || !sub) return null;
  if (typeof exp !== "number") return null;
  if (exp * 1000 <= Date.now()) return null;

  return { authUserId: sub };
}

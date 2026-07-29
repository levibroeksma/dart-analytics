import { createAuthClient } from "@neondatabase/neon-js/auth";

const AUTH_PROXY_PATH = "/api/auth";

export const authClient = createAuthClient(
  `${globalThis.location.origin}${AUTH_PROXY_PATH}`,
);

export async function getAccessToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return result.data?.session?.token ?? null;
}

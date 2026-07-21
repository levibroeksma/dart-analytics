import { createAuthClient } from "@neondatabase/neon-js/auth";

const baseUrl = import.meta.env.PUBLIC_NEON_AUTH_BASE_URL;

if (!baseUrl) {
  throw new Error(
    "PUBLIC_NEON_AUTH_BASE_URL is missing. Copy NEON_AUTH_BASE_URL to PUBLIC_NEON_AUTH_BASE_URL in app/.env and restart the dev server.",
  );
}

export const authClient = createAuthClient(baseUrl);

export async function getAccessToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return result.data?.session?.token ?? null;
}

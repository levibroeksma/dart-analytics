import { createAuthClient } from "@neondatabase/neon-js/auth";

const baseUrl = import.meta.env.PUBLIC_NEON_AUTH_BASE_URL;

if (!baseUrl) {
  throw new Error(
    "PUBLIC_NEON_AUTH_BASE_URL is missing. From app/: run `npm run env:dev` (or `npm run env:mirror`) and restart the dev server.",
  );
}

export const authClient = createAuthClient(baseUrl);

export async function getAccessToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return result.data?.session?.token ?? null;
}

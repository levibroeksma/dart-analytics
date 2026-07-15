import { createAuthClient } from '@neondatabase/neon-js/auth';

const baseUrl = import.meta.env.PUBLIC_NEON_AUTH_BASE_URL as string;

export const authClient = createAuthClient(baseUrl);

export async function getAccessToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return result.data?.session?.token ?? null;
}

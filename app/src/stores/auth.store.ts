import { isPublicPage, normalizePath } from '@utils/auth-routes';
import { authClient } from '@client/auth/client';

type AuthStatus = 'checking' | 'anonymous' | 'authenticated';

async function hasActiveSession(): Promise<boolean> {
  try {
    const result = await authClient.getSession();
    return Boolean(result.data?.session);
  } catch {
    return false;
  }
}

export function authStore() {
  return {
    status: 'checking' as AuthStatus,
    ready: false,

    async init() {
      const hasSession = await hasActiveSession();
      const path = normalizePath(globalThis.location.pathname);

      if (isPublicPage(path) && hasSession) {
        globalThis.location.replace('/');
        return;
      }

      if (!isPublicPage(path) && !hasSession) {
        globalThis.location.replace('/login');
        return;
      }

      this.status = hasSession ? 'authenticated' : 'anonymous';
      this.ready = true;
    },

    async signIn(email: string, password: string) {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        throw new Error(result.error.message ?? 'Sign in failed');
      }
      this.status = 'authenticated';
    },
  };
}

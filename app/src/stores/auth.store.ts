import { isPublicPage, normalizePath } from '@utils/auth-routes';
import { authClient } from '@client/auth/client';

export type AuthStatus = 'checking' | 'anonymous' | 'authenticated';

export function authStore() {
  return {
    status: 'checking' as AuthStatus,
    ready: false,

    async init() {
      const result = await authClient.getSession();
      const hasSession = Boolean(result.data?.session);
      const path = normalizePath(window.location.pathname);

      if (isPublicPage(path) && hasSession) {
        window.location.replace('/');
        return;
      }

      if (!isPublicPage(path) && !hasSession) {
        window.location.replace('/login');
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

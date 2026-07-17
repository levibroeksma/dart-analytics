import type { authStore } from '@stores/auth.store';

type AuthStore = ReturnType<typeof authStore>;

export type LoginFormContext = {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  $store: { auth: Pick<AuthStore, 'signIn'> };
  submit(): Promise<void>;
};

export type LogoutButtonContext = {
  loading: boolean;
  $store: { auth: Pick<AuthStore, 'signOut'> };
  submit(): Promise<void>;
};

export type VerifiedAuth = {
  authUserId: string;
  /** Optional display-name claim, used only by provisioning (D76). */
  name?: string;
};

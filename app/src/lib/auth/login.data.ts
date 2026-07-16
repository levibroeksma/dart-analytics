import { provision } from '@client/api/players';
import { authClient } from '@client/auth/client';
import { getErrorMessage } from '@client/errors';
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

export function loginForm() {
  return {
    email: '',
    password: '',
    error: '',
    loading: false,

    async submit(this: LoginFormContext) {
      this.loading = true;
      this.error = '';

      try {
        await this.$store.auth.signIn(this.email, this.password);

        const session = await authClient.getSession();
        const displayName = session.data?.user?.name;
        await provision(displayName ? { displayName } : undefined);

        location.replace('/');
      } catch (err) {
        this.error = getErrorMessage(err);
        this.loading = false;
      }
    },
  };
}

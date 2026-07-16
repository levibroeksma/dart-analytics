import { provision, ProvisionError } from '@client/api/players';
import { authClient } from '@client/auth/client';
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

export function mapSignInError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (/invalid|credential/i.test(message)) {
    return 'Email or password is incorrect.';
  }
  return 'Could not reach the server. Try again.';
}

export function mapProvisionError(err: ProvisionError): string {
  if (err.code === 'PLAYER_NOT_PROVISIONED' || err.code === 'UNAUTHORIZED') {
    return 'Account setup failed. Contact support.';
  }
  return err.message;
}

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
        if (err instanceof ProvisionError) {
          this.error = mapProvisionError(err);
        } else {
          this.error = mapSignInError(err);
        }
        this.loading = false;
      }
    },
  };
}

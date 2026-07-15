import type { authStore } from '@stores/auth.store';

type AuthStore = ReturnType<typeof authStore>;

export type LogoutButtonContext = {
  loading: boolean;
  $store: { auth: Pick<AuthStore, 'signOut'> };
  submit(): Promise<void>;
};

export function logoutButton() {
  return {
    loading: false,

    async submit(this: LogoutButtonContext) {
      this.loading = true;
      await this.$store.auth.signOut();
      location.replace('/login');
    },
  };
}

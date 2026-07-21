import type { LogoutButtonContext } from "./types";

export function logoutButton() {
  return {
    loading: false,

    async submit(this: LogoutButtonContext) {
      this.loading = true;
      await this.$store.auth.signOut();
      location.replace("/login");
    },
  };
}

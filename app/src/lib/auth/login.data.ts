import { provision } from "@client/api/players";
import { authClient } from "@client/auth/client";
import { getErrorMessage } from "@client/errors";
import type { LoginFormContext } from "./types";

export function loginForm() {
  return {
    email: "",
    password: "",
    error: "",
    loading: false,

    async submit(this: LoginFormContext) {
      this.loading = true;
      this.error = "";

      try {
        await this.$store.auth.signIn(this.email, this.password);

        const session = await authClient.getSession();
        const displayName = session.data?.user?.name;
        await provision(displayName ? { displayName } : undefined);

        location.replace("/");
      } catch (err) {
        this.error = getErrorMessage(err);
        this.loading = false;
      }
    },
  };
}

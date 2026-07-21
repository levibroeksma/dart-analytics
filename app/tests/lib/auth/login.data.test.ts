import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/players", () => ({
  provision: vi.fn(),
  ProvisionError: class ProvisionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "ProvisionError";
    }
  },
}));

import { provision } from "@client/api/players";
import { authClient } from "@client/auth/client";
import { loginForm } from "@auth/login.data";
import type { LoginFormContext } from "@auth/types";

describe("loginForm.submit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { name: "Levi" }, session: {} },
    });
  });

  it("calls provision after signIn and redirects", async () => {
    vi.mocked(provision).mockResolvedValue({
      playerId: "p1",
      authUserId: "a1",
      created: true,
    });
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });

    const form = loginForm();
    (form as unknown as LoginFormContext).$store = {
      auth: {
        signIn: vi.fn().mockResolvedValue(undefined),
      },
    };
    form.email = "levi@broeksma.nl";
    form.password = "admin";

    await (form as unknown as LoginFormContext).submit();

    expect(provision).toHaveBeenCalledWith({ displayName: "Levi" });
    expect(replace).toHaveBeenCalledWith("/");

    vi.unstubAllGlobals();
  });

  it("sets error message on signIn failure", async () => {
    const form = loginForm();
    (form as unknown as LoginFormContext).$store = {
      auth: {
        signIn: vi
          .fn()
          .mockRejectedValue(new Error("Invalid email or password")),
      },
    };
    await (form as unknown as LoginFormContext).submit();
    expect(form.error).toBe("Email or password is incorrect.");
    expect(form.loading).toBe(false);
  });
});

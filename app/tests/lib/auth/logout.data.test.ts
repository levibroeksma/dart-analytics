import { describe, it, expect, vi, beforeEach } from "vitest";
import { logoutButton } from "@auth/logout.data";
import type { LogoutButtonContext } from "@auth/types";

describe("logoutButton.submit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sets loading, calls signOut, then redirects to /login", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });

    const signOut = vi.fn().mockResolvedValue(undefined);
    const button = logoutButton();
    (button as unknown as LogoutButtonContext).$store = {
      auth: { signOut },
    };

    const submitPromise = (button as unknown as LogoutButtonContext).submit();
    expect(button.loading).toBe(true);
    await submitPromise;

    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/login");

    vi.unstubAllGlobals();
  });
});

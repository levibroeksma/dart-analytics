import { describe, it, expect, vi, beforeEach } from "vitest";

const envAccessMock = vi.fn();

vi.mock("@lib/env", () => ({
  get env() {
    return {
      auth: {
        get jwksUrl() {
          envAccessMock();
          return "https://auth.example.com/jwks";
        },
      },
    };
  },
}));

describe("verify-jwt", () => {
  beforeEach(() => {
    vi.resetModules();
    envAccessMock.mockClear();
  });

  it("does not access env merely by importing the module", async () => {
    await import("../../../src/lib/auth/verify-jwt");
    expect(envAccessMock).not.toHaveBeenCalled();
  });

  it("resolves null without accessing env when there is no Bearer header", async () => {
    const { verifyBearerToken } =
      await import("../../../src/lib/auth/verify-jwt");
    const result = await verifyBearerToken(null);
    expect(result).toBeNull();
    expect(envAccessMock).not.toHaveBeenCalled();
  });
});

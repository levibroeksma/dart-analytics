import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "@client/api/client";
import { provision, ProvisionError } from "@client/api/players";

describe("provision", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns parsed data on success", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: { playerId: "p1", authUserId: "a1", created: true },
    });
    const result = await provision({ displayName: "Levi" });
    expect(result.created).toBe(true);
  });

  it("throws ProvisionError on api failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        retryable: false,
      },
    });
    await expect(provision()).rejects.toBeInstanceOf(ProvisionError);
  });
});

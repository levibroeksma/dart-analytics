import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/auth/client", () => ({
  getAccessToken: vi.fn(),
}));

import { getAccessToken } from "@client/auth/client";
import { apiRequest } from "@client/api/client";

describe("apiRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns UNAUTHORIZED when no token", async () => {
    vi.mocked(getAccessToken).mockResolvedValue(null);
    const result = await apiRequest("/api/players/provision");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("attaches Bearer header and parses success envelope", async () => {
    vi.mocked(getAccessToken).mockResolvedValue("test-jwt");
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        data: { playerId: "p1", authUserId: "a1", created: true },
        requestId: "req-1",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest("/api/players/provision", {
      method: "POST",
      body: "{}",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/players/provision",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-jwt");
    expect(result.ok).toBe(true);

    vi.unstubAllGlobals();
  });
});

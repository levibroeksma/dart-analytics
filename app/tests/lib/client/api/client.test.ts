import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/auth/client", () => ({
  getAccessToken: vi.fn(),
}));

import { getAccessToken } from "@client/auth/client";
import { apiRequest, unwrapOrThrow } from "@client/api/client";
import { SessionApiError } from "@client/api/sessions";

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

  it("returns a retryable SERVICE_UNAVAILABLE failure on a non-JSON 500 (no throw)", async () => {
    vi.mocked(getAccessToken).mockResolvedValue("test-jwt");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      }),
    );
    const result = await apiRequest("/api/sessions/active");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
    }
    vi.unstubAllGlobals();
  });

  it("retries a GET on a retryable failure, then succeeds", async () => {
    vi.useFakeTimers();
    vi.mocked(getAccessToken).mockResolvedValue("test-jwt");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ ok: true, data: [], requestId: "r" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const pending = apiRequest("/api/sessions/active");
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not retry a POST", async () => {
    vi.mocked(getAccessToken).mockResolvedValue("test-jwt");
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await apiRequest("/api/sessions", {
      method: "POST",
      body: "{}",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    vi.unstubAllGlobals();
  });

  it("treats a 204 as a success envelope with null data", async () => {
    vi.mocked(getAccessToken).mockResolvedValue("test-jwt");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    const result = await apiRequest("/api/routines/x", { method: "DELETE" });
    expect(result).toMatchObject({ ok: true, data: null });
    vi.unstubAllGlobals();
  });
});

describe("unwrapOrThrow", () => {
  it("returns the data of a success envelope", () => {
    expect(unwrapOrThrow({ ok: true, data: { x: 1 }, requestId: "r" })).toEqual(
      { x: 1 },
    );
  });

  it("throws a SessionApiError carrying code, requestId and details on a failure envelope", () => {
    expect(() =>
      unwrapOrThrow({
        ok: false,
        requestId: "r",
        error: {
          code: "VALIDATION_FAILED",
          message: "bad",
          retryable: false,
          details: { issues: ["x"] },
        },
      }),
    ).toThrowError(SessionApiError);
    try {
      unwrapOrThrow({
        ok: false,
        requestId: "r",
        error: {
          code: "VALIDATION_FAILED",
          message: "bad",
          retryable: false,
          details: { issues: ["x"] },
        },
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "VALIDATION_FAILED",
        requestId: "r",
        details: { issues: ["x"] },
      });
    }
  });
});

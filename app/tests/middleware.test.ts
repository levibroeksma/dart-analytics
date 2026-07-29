import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lib/auth/verify-jwt", () => ({ verifyBearerToken: vi.fn() }));
vi.mock("@db/client", () => ({ getDb: vi.fn() }));

import { verifyBearerToken } from "@lib/auth/verify-jwt";
import { getDb } from "@db/client";
import { onRequest } from "../src/middleware";

function ctxFor(path: string) {
  return {
    locals: {} as Record<string, unknown>,
    url: new URL(`https://x${path}`),
    request: new Request(`https://x${path}`, {
      headers: { authorization: "Bearer t" },
    }),
  };
}

describe("middleware error boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyBearerToken).mockResolvedValue({
      authUserId: "u1",
    } as never);
    vi.mocked(getDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([{ id: "p1" }]) }),
        }),
      }),
    } as never);
  });

  it("envelopes a generic thrown error as 500 INTERNAL_ERROR", async () => {
    const next = vi.fn(() => {
      throw new Error("boom");
    });
    const res = await onRequest(
      ctxFor("/api/sessions/active") as never,
      next as never,
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(500);
    const body = await (res as Response).json();
    expect(body).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
    expect(body.requestId).toBeTruthy();
  });

  it("envelopes a transient thrown error as 503 SERVICE_UNAVAILABLE", async () => {
    const next = vi.fn(() => {
      throw new Error("Connection terminated");
    });
    const res = await onRequest(
      ctxFor("/api/sessions/active") as never,
      next as never,
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(503);
    const body = await (res as Response).json();
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.error.retryable).toBe(true);
  });

  it("does not envelope a thrown error on a page route", async () => {
    const next = vi.fn(() => {
      throw new Error("page boom");
    });
    await expect(
      onRequest(ctxFor("/games") as never, next as never),
    ).rejects.toThrow("page boom");
  });
});

describe("middleware auth proxy bypass", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips JWT verification for /api/auth/* and returns next() directly", async () => {
    const next = vi.fn(() => new Response("proxied", { status: 200 }));
    const res = await onRequest(
      ctxFor("/api/auth/sign-in/email") as never,
      next as never,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(verifyBearerToken).not.toHaveBeenCalled();
    expect((res as Response).status).toBe(200);
    expect(await (res as Response).text()).toBe("proxied");
  });

  it("does not envelope a thrown error on the auth proxy route", async () => {
    const next = vi.fn(() => {
      throw new Error("proxy boom");
    });
    await expect(
      onRequest(ctxFor("/api/auth/get-session") as never, next as never),
    ).rejects.toThrow("proxy boom");
  });
});

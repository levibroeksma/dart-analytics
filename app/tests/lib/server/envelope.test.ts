import { describe, it, expect } from "vitest";
import { ok, fail } from "@server/envelope";
import { ERROR_HTTP } from "@server/errors";

const REQUEST_ID = "3f1c9a2e-0b7d-4f8a-9c31-6d5e2a8b4c70";

describe("ok()", () => {
  it("emits X-Request-Id carrying the same id the body echoes", async () => {
    const response = ok({ sessionId: "abc" }, REQUEST_ID);

    expect(response.headers.get("X-Request-Id")).toBe(REQUEST_ID);
    expect(await response.json()).toEqual({
      ok: true,
      data: { sessionId: "abc" },
      requestId: REQUEST_ID,
    });
  });

  it("keeps the JSON content type and the caller's status", () => {
    const response = ok({}, REQUEST_ID, 201);

    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.status).toBe(201);
  });
});

describe("fail()", () => {
  it("emits X-Request-Id carrying the same id the body echoes", async () => {
    const response = fail("VALIDATION_FAILED", REQUEST_ID, { field: "score" });

    expect(response.headers.get("X-Request-Id")).toBe(REQUEST_ID);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: ERROR_HTTP.VALIDATION_FAILED.message,
        retryable: ERROR_HTTP.VALIDATION_FAILED.retryable,
        details: { field: "score" },
      },
      requestId: REQUEST_ID,
    });
  });

  it("keeps the JSON content type and the registry's status", () => {
    const response = fail("UNAUTHORIZED", REQUEST_ID);

    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.status).toBe(ERROR_HTTP.UNAUTHORIZED.status);
  });

  it("gives two responses independent header sets", () => {
    const first = ok({}, "req-one");
    const second = fail("INTERNAL_ERROR", "req-two");

    expect(first.headers.get("X-Request-Id")).toBe("req-one");
    expect(second.headers.get("X-Request-Id")).toBe("req-two");
  });
});

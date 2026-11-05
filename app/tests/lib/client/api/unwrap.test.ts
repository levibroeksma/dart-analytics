import { describe, it, expect } from "vitest";
import { unwrapOrThrow } from "@client/api/unwrap";
import { SessionApiError } from "@client/api/sessions";
import { SessionApiError as SessionApiErrorClass } from "@client/api/session-api-error";

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
    ).toThrow(SessionApiError);
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

  it("throws the one SessionApiError class, whether imported from sessions or session-api-error", () => {
    expect(SessionApiError).toBe(SessionApiErrorClass);
    const error = (() => {
      try {
        return unwrapOrThrow({
          ok: false,
          requestId: "r",
          error: { code: "X", message: "m", retryable: false },
        });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(SessionApiError);
    expect(error).toBeInstanceOf(SessionApiErrorClass);
  });
});

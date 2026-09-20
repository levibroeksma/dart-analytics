import { describe, it, expect } from "vitest";
import { unwrapOrThrow } from "@client/api/unwrap";
import { SessionApiError } from "@client/api/sessions";

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
});

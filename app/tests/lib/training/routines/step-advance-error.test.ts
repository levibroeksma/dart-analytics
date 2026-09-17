import { describe, it, expect } from "vitest";
import { stepAdvanceErrorMessage } from "@lib/training/routines/step-advance-error";

describe("stepAdvanceErrorMessage", () => {
  it("names the code and request id for any coded failure", () => {
    expect(
      stepAdvanceErrorMessage(
        Object.assign(new Error("Batch rejected"), {
          code: "INTERNAL_ERROR",
          requestId: "req-77",
        }),
      ),
    ).toBe(
      "Could not continue to the next step (INTERNAL_ERROR, req-77). Try again.",
    );
  });

  it("omits the request id when the envelope carried none", () => {
    expect(
      stepAdvanceErrorMessage(
        Object.assign(new Error("Batch rejected"), { code: "INTERNAL_ERROR" }),
      ),
    ).toBe("Could not continue to the next step (INTERNAL_ERROR). Try again.");
  });

  it("falls back to the generic message for an error carrying no code", () => {
    expect(stepAdvanceErrorMessage(new Error("boom"))).toBe(
      "Could not continue to the next step. Try again.",
    );
  });
});

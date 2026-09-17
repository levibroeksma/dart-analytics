import { describe, it, expect } from "vitest";
import { routineStartErrorMessage } from "@lib/training/routine-start-error";

describe("routineStartErrorMessage", () => {
  it("names the code and request id for any coded failure", () => {
    expect(
      routineStartErrorMessage(
        Object.assign(new Error("rejected"), {
          code: "INTERNAL_ERROR",
          requestId: "req-42",
        }),
      ),
    ).toBe("Could not start this routine (INTERNAL_ERROR, req-42). Try again.");
  });

  it("omits the request id when the envelope carried none", () => {
    expect(
      routineStartErrorMessage(
        Object.assign(new Error("rejected"), { code: "VALIDATION_FAILED" }),
      ),
    ).toBe("Could not start this routine (VALIDATION_FAILED). Try again.");
  });

  it("keeps the connection wording for an error carrying no code", () => {
    expect(routineStartErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Could not start this routine. Check your connection and retry.",
    );
  });
});

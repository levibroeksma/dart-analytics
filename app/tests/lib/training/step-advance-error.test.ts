import { describe, it, expect } from "vitest";
import { stepAdvanceErrorMessage } from "@lib/training/step-advance-error";

describe("stepAdvanceErrorMessage", () => {
  it("names the unfinished game for an already-active session, the one failure the player can act on", () => {
    expect(
      stepAdvanceErrorMessage(
        Object.assign(new Error("Session already active"), {
          code: "SESSION_ALREADY_ACTIVE",
          requestId: "req-1",
        }),
      ),
    ).toBe(
      "You have an unfinished Ten Up One Down game. Finish or abandon it under Games, then start this routine again.",
    );
  });

  it("names the code and request id for any other coded failure", () => {
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
